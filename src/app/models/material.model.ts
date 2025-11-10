export interface Material {
  id: string;
  questionnaireNo: string;
  researchAssistantNo: string;
  name: string;
  type: string[];
  location: {
    name: string;
    latitude: number;
    longitude: number;
    county: string;
    subCounty: string;
    ward: string;
  };
  challenges: string[];
  recommendations: string[];
  timestamp: string;
  icon: string;
  
  // Additional fields from API
  materialUsedIn?: string;
  sizeOfManufacturingIndustry?: string;
  periodOfManufacture?: string;
  ownerOfMaterial?: string;
  materialUsage?: string;
  numberOfPeopleEmployed?: string;
  similarLocations?: string;
  volumeProducedPerDay?: string;
  comments?: string;
}

// API response interface
export interface ApiMaterialSite {
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
  similarLocations: string | null;
  volumeProducedPerDay: string;
  comments: string | null;
}