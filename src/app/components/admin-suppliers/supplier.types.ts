export interface Supplier {
  id: number;
  companyName: string;
  businessRegistrationNumber: string;
  contactPerson: string;
  email: string;
  password: string;
  phone: string;
  website: string;
  description: string;
  yearsInBusiness: number;
  logoUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  role: 'CONTRACTOR' | 'SUPPLIER';
  verificationDate?: string;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
}

export interface SupplierDocument {
  id: number;
  fileName: string;
  fileType: string;
  url: string;
  supplier: Supplier;
  uploadedAt: string;
}

export interface MaterialSite {
  id: number;
  questionnaireNo: number;
  researchAssistantNo: string;
  material: string;
  materialLocation: string;
  latitude: number;
  longitude: number;
  materialUsedIn: string;
  sizeOfManufacturingIndustry: string;
  periodOfManufacture: string;
  ownerOfMaterial: string;
  materialUsage: string;
  numberOfPeopleEmployed: string;
  similarLocations: string;
  volumeProducedPerDay: string;
  comments: string;
  county: string;
  subCounty: string;
}

export interface ApiResponse<T> {
  data: T;
  messageCode: string;
  message: string;
}