import { MedplumService } from './medplum.service';
import { AIService } from './ai.service';

interface ConversationContext {
  patientId?: string;
  currentIntent?: any;
  step?: string;
  pendingAppointment?: any;
  availableSlots?: any[];
}

export class AppointmentService {
  private medplum: MedplumService;
  private ai: AIService;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor() {
    this.medplum = new MedplumService();
    this.ai = new AIService();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Appointment Service...');
    await this.medplum.initialize();
    console.log('✅ Appointment Service ready');
  }

  async handleMessage(
    message: string,
    sessionId: string,
    userInfo?: { phone?: string; name?: string }
  ): Promise<string> {
    try {
      console.log(`📨 Handling message from session ${sessionId}: "${message}"`);
      
      // Get or create conversation context
      let context = this.conversations.get(sessionId) || {};
      
      // Check if we're in slot selection mode
      if (context.step === 'slot_selection' && context.availableSlots) {
        console.log('🎯 In slot selection mode');
        return await this.handleSlotSelection(message, context, userInfo);
      }
      
      // Extract intent from message
      const intent = await this.ai.extractIntent(message);
      
      // Handle different actions
      let response: string;
      
      switch (intent.action) {
        case 'book':
          response = await this.handleBooking(intent, context, userInfo, sessionId);
          break;
        case 'reschedule':
          response = await this.handleReschedule(intent, context);
          break;
        case 'cancel':
          response = await this.handleCancellation(intent, context);
          break;
        case 'inquire':
          response = await this.handleInquiry(intent, context);
          break;
        default:
          response = await this.ai.generateResponse(intent, context);
      }
      
      // Update conversation context
      context.currentIntent = intent;
      this.conversations.set(sessionId, context);
      
      console.log(`✅ Response generated for session ${sessionId}`);
      return response;
    } catch (error) {
      console.error('Error handling message:', error);
      return 'I apologize, but I encountered an error. Please try again or contact our office directly.';
    }
  }

  private async handleBooking(
    intent: any,
    context: ConversationContext,
    userInfo?: { phone?: string; name?: string },
    sessionId?: string
  ): Promise<string> {
    console.log('📅 Processing booking request...');
    
    // Check for missing required information
    const missingInfo = [];
    
    if (!intent.preferredDate) missingInfo.push('preferred date');
    if (!userInfo?.phone) missingInfo.push('phone number');
    if (!userInfo?.name && !intent.patientName) missingInfo.push('your name');
    
    if (missingInfo.length > 0) {
      return `I'd be happy to help you book an appointment! I just need a few more details: ${missingInfo.join(', ')}. Could you please provide this information?`;
    }
    
    // Find patient or create new one
    let patient = userInfo?.phone ? 
      await this.medplum.findPatientByPhone(userInfo.phone) : null;
    
    if (!patient && userInfo?.phone && userInfo?.name) {
      patient = await this.medplum.createPatient({
        name: [{ text: userInfo.name }],
        telecom: [{ system: 'phone', value: userInfo.phone }],
      });
    }
    
    if (!patient) {
      return 'I need to create your patient record first. Could you please provide your full name and phone number?';
    }
    
    // Parse date
    const targetDate = this.parseDate(intent.preferredDate);
    
    // Find available slots
    const slots = await this.medplum.findAvailableSlots(
      targetDate.toISOString().split('T')[0]
    );
    
    if (slots.length === 0) {
      return `I don't see any available appointments on ${targetDate.toDateString()}. Would you like to try a different date?`;
    }
    
    // Filter by time preference if specified
    const filteredSlots = this.filterSlotsByTime(slots, intent.preferredTime);
    
    if (filteredSlots.length === 0) {
      // Show all available slots if preferred time isn't available
      context.step = 'slot_selection';
      context.pendingAppointment = {
        patientId: patient.id,
        reason: intent.reason,
        appointmentType: intent.appointmentType,
      };
      context.availableSlots = slots;
      
      return `I don't have any ${intent.preferredTime || ''} appointments available on ${targetDate.toDateString()}. Here are the available times:\n\n${this.formatAvailableSlots(slots)}\n\nWhich time works best for you? Reply with the number (1, 2, 3, etc.).`;
    }
    
    // Set up slot selection context
    context.step = 'slot_selection';
    context.pendingAppointment = {
      patientId: patient.id,
      reason: intent.reason,
      appointmentType: intent.appointmentType,
    };
    context.availableSlots = filteredSlots;
    
    return `Great! I found these available appointments on ${targetDate.toDateString()}:\n\n${this.formatAvailableSlots(filteredSlots)}\n\nWhich time works best for you? Reply with the number (1, 2, 3, etc.).`;
  }
  
  private async handleSlotSelection(
    message: string,
    context: ConversationContext,
    userInfo?: { phone?: string; name?: string }
  ): Promise<string> {
    console.log('🎯 Processing slot selection...');
    
    if (!context.availableSlots || !context.pendingAppointment) {
      return 'It seems like we lost track of your booking. Could you please start over with your appointment request?';
    }
    
    // Try to determine which slot they selected
    let selectedSlot = null;
    const cleanMessage = message.trim();
    
    // Check for number selection (1, 2, 3, etc.)
    const numberMatch = cleanMessage.match(/^([1-9])\s*$/);
    if (numberMatch) {
      const slotIndex = parseInt(numberMatch[1]) - 1;
      console.log(`Trying to select slot at index ${slotIndex} from ${context.availableSlots.length} slots`);
      if (slotIndex >= 0 && slotIndex < context.availableSlots.length) {
        selectedSlot = context.availableSlots[slotIndex];
      }
    }
    
    // If no clear selection, ask for clarification
    if (!selectedSlot) {
      return `I'm not sure which appointment time you'd like. Please reply with just the number (1, 2, 3, etc.) corresponding to your preferred time:\n\n${this.formatAvailableSlots(context.availableSlots)}`;
    }
    
    // Book the appointment
    try {
      const appointment = await this.medplum.bookAppointment({
        patientId: context.pendingAppointment.patientId,
        slotId: selectedSlot.id,
        reason: context.pendingAppointment.reason,
        notes: `Booked via AI agent. Type: ${context.pendingAppointment.appointmentType || 'General'}`
      });
      
      // Clear the context
      context.step = undefined;
      context.pendingAppointment = undefined;
      context.availableSlots = undefined;
      
      const appointmentTime = new Date(selectedSlot.start).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      
      return `Perfect! I've booked your appointment for ${appointmentTime}.\n\n📅 **Appointment Confirmed**\n🆔 Confirmation: ${appointment.id}\n⏰ Time: ${appointmentTime}\n\nIs there anything else I can help you with?`;
    } catch (error) {
      console.error('Error booking appointment:', error);
      return 'I encountered an error while booking your appointment. Please try again or contact our office directly.';
    }
  }
  
  private parseDate(dateString: string): Date {
    const today = new Date();
    
    if (!dateString) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    
    const lowerDate = dateString.toLowerCase();
    
    if (lowerDate.includes('today')) {
      return today;
    }
    
    if (lowerDate.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    
    if (lowerDate.includes('next week')) {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return nextWeek;
    }
    
    // Default to tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow;
  }
  
  private filterSlotsByTime(slots: any[], timePreference?: string): any[] {
    if (!timePreference) return slots;
    
    return slots.filter(slot => {
      const hour = new Date(slot.start).getHours();
      
      switch (timePreference.toLowerCase()) {
        case 'morning':
          return hour >= 8 && hour < 12;
        case 'afternoon':
          return hour >= 12 && hour < 17;
        case 'evening':
          return hour >= 17 && hour < 20;
        default:
          return true;
      }
    });
  }
  
  private formatAvailableSlots(slots: any[]): string {
    return slots
      .slice(0, 5)
      .map((slot, index) => {
        const time = new Date(slot.start).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return `${index + 1}. ${time}`;
      })
      .join('\n');
  }
  
  private async handleReschedule(intent: any, context: ConversationContext): Promise<string> {
    return 'I can help you reschedule your appointment. Could you please provide your current appointment date and time, and when you\'d like to reschedule to?';
  }
  
  private async handleCancellation(intent: any, context: ConversationContext): Promise<string> {
    return 'I can help you cancel your appointment. Could you please provide the date and time of the appointment you\'d like to cancel?';
  }
  
  private async handleInquiry(intent: any, context: ConversationContext): Promise<string> {
    return 'I\'m here to help with appointment booking, rescheduling, and cancellations. You can say things like:\n\n• "I need to book a checkup for tomorrow morning"\n• "Can I reschedule my Tuesday appointment?"\n• "I want to cancel my appointment"\n\nWhat would you like to do?';
  }
}
