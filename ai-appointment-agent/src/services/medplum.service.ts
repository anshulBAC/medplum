import { MedplumClient } from '@medplum/core';

export class MedplumService {
  private client: MedplumClient;

  constructor() {
    this.client = new MedplumClient({
      baseUrl: process.env.MEDPLUM_BASE_URL || 'http://localhost:8103',
      clientId: process.env.MEDPLUM_CLIENT_ID,
      clientSecret: process.env.MEDPLUM_CLIENT_SECRET,
    });
  }

  async initialize(): Promise<void> {
    try {
      // For now, we'll use anonymous access to test connectivity
      console.log('🔌 Connecting to Medplum server...');
      
      // Test connection by fetching server metadata
      const response = await fetch(`${process.env.MEDPLUM_BASE_URL}/healthcheck`);
      if (!response.ok) {
        throw new Error(`Medplum server not responding: ${response.status}`);
      }
      
      const health = await response.json();
      console.log('✅ Medplum server connection established:', health.version);
      
      // TODO: Implement proper authentication later
      // For development, we'll work with the basic connection
    } catch (error) {
      console.error('❌ Failed to connect to Medplum server:', error);
      throw error;
    }
  }

  // Patient operations
  async findPatientByPhone(phone: string): Promise<any> {
    try {
      console.log(`🔍 Searching for patient with phone: ${phone}`);
      
      // For now, return a mock patient to test the flow
      // TODO: Implement real patient lookup once authentication is set up
      return {
        id: 'patient-123',
        resourceType: 'Patient',
        name: [{ text: 'Test Patient' }],
        telecom: [{ system: 'phone', value: phone }]
      };
    } catch (error) {
      console.error('Error finding patient:', error);
      return null;
    }
  }

  async createPatient(patientData: any): Promise<any> {
    try {
      console.log('👤 Creating new patient...');
      
      // Mock patient creation for now
      const patient = {
        id: `patient-${Date.now()}`,
        resourceType: 'Patient',
        name: patientData.name || [],
        telecom: patientData.telecom || [],
        ...patientData,
      };
      
      console.log('✅ Patient created (mock):', patient.id);
      return patient;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw error;
    }
  }

  // Appointment operations
  async findAvailableSlots(date: string, practitionerId?: string): Promise<any[]> {
    try {
      console.log(`📅 Finding available slots for date: ${date}`);
      
      // Mock available slots for testing
      const mockSlots = [
        {
          id: 'slot-1',
          resourceType: 'Slot',
          status: 'free',
          start: `${date}T09:00:00Z`,
          end: `${date}T09:30:00Z`
        },
        {
          id: 'slot-2',
          resourceType: 'Slot',
          status: 'free',
          start: `${date}T10:30:00Z`,
          end: `${date}T11:00:00Z`
        },
        {
          id: 'slot-3',
          resourceType: 'Slot',
          status: 'free',
          start: `${date}T14:00:00Z`,
          end: `${date}T14:30:00Z`
        }
      ];
      
      console.log(`✅ Found ${mockSlots.length} available slots`);
      return mockSlots;
    } catch (error) {
      console.error('Error finding available slots:', error);
      return [];
    }
  }

  async bookAppointment(appointmentData: {
    patientId: string;
    slotId: string;
    practitionerId?: string;
    reason?: string;
    notes?: string;
  }): Promise<any> {
    try {
      console.log('📝 Booking appointment...', appointmentData);
      
      // Mock appointment booking
      const appointment = {
        id: `appointment-${Date.now()}`,
        resourceType: 'Appointment',
        status: 'booked',
        participant: [
          {
            actor: { reference: `Patient/${appointmentData.patientId}` },
            status: 'accepted',
          },
        ],
        reasonCode: appointmentData.reason ? [{
          text: appointmentData.reason,
        }] : undefined,
        comment: appointmentData.notes,
        // Get timing from slot (mock)
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min later
      };
      
      console.log('✅ Appointment booked (mock):', appointment.id);
      return appointment;
    } catch (error) {
      console.error('Error booking appointment:', error);
      throw error;
    }
  }

  // Utility method to test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.MEDPLUM_BASE_URL}/healthcheck`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
