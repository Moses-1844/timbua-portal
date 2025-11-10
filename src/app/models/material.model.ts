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
  icon?: string; // Add icon property
}
/*export interface Material {
  id: string;
  name: string;
  type: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    region: string;
    county: string;
  };
  supplier: {
    name: string;
    contact: string;
    email: string;
    license: string;
  };
  specifications: {
    quality: 'High' | 'Medium' | 'Low';
    certification: string[];
    durability: string;
    environmentalImpact: string;
  };
  pricing: {
    unit: string;
    price: number;
    currency: string;
    discount: number;
  };
  availability: {
    quantity: number;
    status: 'Available' | 'Limited' | 'Out of Stock';
    deliveryTime: string;
  };
  sustainability: {
    ecoFriendly: boolean;
    recyclable: boolean;
    carbonFootprint: string;
  };
  timestamp: string;
}*/