import OpenAI from 'openai';

interface AppointmentIntent {
  action: 'book' | 'reschedule' | 'cancel' | 'inquire' | 'unclear';
  appointmentType?: string;
  preferredDate?: string;
  preferredTime?: string;
  practitionerName?: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
  patientName?: string;
  phone?: string;
  reason?: string;
  confidence: number;
  missingInfo?: string[];
  originalMessage?: string;
}

export class AIService {
  private openai?: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key') {
      console.warn('⚠️ OpenAI API key not found. AI features will use mock responses.');
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async extractIntent(message: string): Promise<AppointmentIntent> {
    console.log(`🧠 Analyzing message: "${message}"`);
    
    if (!this.openai) {
      return this.mockIntentExtraction(message);
    }

    const systemPrompt = `You are an AI assistant that extracts appointment booking intents from patient messages.

Extract the following information and return as JSON:
- action: "book", "reschedule", "cancel", "inquire", or "unclear"
- appointmentType: type of appointment (checkup, consultation, followup, etc.)
- preferredDate: in YYYY-MM-DD format or relative (tomorrow, next week, etc.)
- preferredTime: specific time or general (morning, afternoon, evening)
- practitionerName: doctor's name if mentioned
- urgency: routine, urgent, or emergency
- patientName: patient's name if mentioned
- phone: phone number if mentioned
- reason: reason for appointment
- confidence: 0-1 score of how confident you are
- missingInfo: array of missing required information
- originalMessage: the original message text`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const intent = JSON.parse(content) as AppointmentIntent;
      intent.originalMessage = message; // Add original message for context
      console.log('✅ Intent extracted:', intent);
      return intent;
    } catch (error) {
      console.error('Error extracting intent:', error);
      return {
        action: 'unclear',
        confidence: 0,
        missingInfo: ['Unable to understand request'],
        originalMessage: message,
      };
    }
  }

  private mockIntentExtraction(message: string): AppointmentIntent {
    console.log('🎭 Using mock intent extraction');
    
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('appointment')) {
      return {
        action: 'book',
        appointmentType: lowerMessage.includes('checkup') ? 'checkup' : 'consultation',
        preferredDate: lowerMessage.includes('tomorrow') ? 'tomorrow' : 
                      lowerMessage.includes('next week') ? 'next week' : undefined,
        preferredTime: lowerMessage.includes('morning') ? 'morning' :
                      lowerMessage.includes('afternoon') ? 'afternoon' :
                      lowerMessage.includes('evening') ? 'evening' : undefined,
        confidence: 0.8,
        missingInfo: [],
        originalMessage: message,
      };
    }
    
    if (lowerMessage.includes('reschedule') || lowerMessage.includes('change')) {
      return {
        action: 'reschedule',
        confidence: 0.8,
        missingInfo: ['current appointment details', 'new preferred time'],
        originalMessage: message,
      };
    }
    
    if (lowerMessage.includes('cancel')) {
      return {
        action: 'cancel',
        confidence: 0.8,
        missingInfo: ['appointment details to cancel'],
        originalMessage: message,
      };
    }
    
    return {
      action: 'unclear',
      confidence: 0.5,
      missingInfo: ['Could not understand the request'],
      originalMessage: message,
    };
  }

  async generateResponse(
    intent: AppointmentIntent,
    context: any = {}
  ): Promise<string> {
    console.log('💭 Generating response for intent:', intent.action);
    
    if (!this.openai) {
      return this.mockResponseGeneration(intent, context);
    }

    const systemPrompt = `You are a friendly medical office AI assistant helping patients book appointments.

Generate a helpful, professional response. If information is missing, politely ask for it.
Keep responses concise but warm. Always confirm important details.
Use a conversational, friendly tone like a helpful receptionist.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify({ intent, context }) }
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content || 
        'I apologize, but I had trouble processing your request. Please try again.';
      
      console.log('✅ Response generated');
      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      return 'I apologize, but I had trouble processing your request. Please try again.';
    }
  }

  private mockResponseGeneration(intent: AppointmentIntent, context: any): string {
    console.log('🎭 Using mock response generation');
    
    switch (intent.action) {
      case 'book':
        if (intent.missingInfo && intent.missingInfo.length > 0) {
          return `I'd be happy to help you book an appointment! I just need a few more details: ${intent.missingInfo.join(', ')}. Could you please provide this information?`;
        }
        return `Great! I can help you book ${intent.appointmentType ? `a ${intent.appointmentType}` : 'an appointment'}${intent.preferredDate ? ` for ${intent.preferredDate}` : ''}${intent.preferredTime ? ` in the ${intent.preferredTime}` : ''}. Let me check availability for you.`;
      
      case 'reschedule':
        return 'I can help you reschedule your appointment. Could you please provide your current appointment date and time, and when you\'d like to reschedule to?';
      
      case 'cancel':
        return 'I can help you cancel your appointment. Could you please provide the date and time of the appointment you\'d like to cancel?';
      
      case 'inquire':
        return 'I\'m here to help with appointment booking, rescheduling, and cancellations. What would you like to know?';
      
      default:
        return 'I\'m not sure I understood that. I can help you book, reschedule, or cancel appointments. What would you like to do?';
    }
  }
}
