export interface Contractor {
  id: number;
  companyName: string;
  email: string;
  password: string;
  contactPerson: string;
  phoneNumber: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  specialization: string;
  yearsOfExperience: number;
  licenseNumber: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  role: 'CONTRACTOR';
  isVerified: boolean;
  registrationDate: string;
  verificationDate?: string;
}

export interface Document {
  id: number;
  documentType: string;
  documentName: string;
  documentUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  contractor: Contractor;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Site {
  id: number;
  name: string;
  location: string;
  coordinates: Coordinates;
  type: string;
  estimatedCost: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  startDate: string;
  endDate: string;
  progress: number;
  contractor: Contractor;
}