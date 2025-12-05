import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

// Define interfaces for API responses
interface ApiResponse<T> {
  data?: T;
  suppliers?: T;
  materials?: T;
  [key: string]: any;
}

interface Supplier {
  id: number;
  companyName: string;
  email: string;
  contactPerson: string;
  phoneNumber: string;
  latitude?: number;
  longitude?: number;
  materials?: number[];
  verified?: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  [key: string]: any;
}

interface Material {
  id: number;
  name: string;
  category: string;
  unit: string;
  pricePerUnit?: number;
  description?: string;
  [key: string]: any;
}

interface Site {
  id: number;
  name: string;
  location: string;
  type: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class SmartQuotationService {
  private apiUrl = 'https://timbuabackend.onrender.com/api';
  
  // Material database for fallback if AI fails
  private materialDatabase = [
    { type: 'residential', materials: ['Cement', 'Sand', 'Aggregate', 'Steel Bars', 'Bricks', 'Tiles', 'Paint', 'Plumbing Pipes', 'Electrical Wires'] },
    { type: 'commercial', materials: ['Concrete', 'Steel', 'Glass', 'Aluminum', 'HVAC Equipment', 'Elevator Parts', 'Fire Safety Equipment'] },
    { type: 'industrial', materials: ['Structural Steel', 'Precast Concrete', 'Industrial Pipes', 'Heavy Machinery Parts', 'Safety Equipment'] },
    { type: 'road', materials: ['Asphalt', 'Bitumen', 'Road Base', 'Curb Stones', 'Road Signs', 'Drainage Pipes'] },
    { type: 'bridge', materials: ['Structural Steel', 'Concrete', 'Reinforcement Bars', 'Bearings', 'Expansion Joints'] }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Get contractor's sites
   */
  getContractorSites(contractorId: number): Observable<Site[]> {
    return this.http.get<Site[]>(`${this.apiUrl}/sites/contractor/${contractorId}`).pipe(
      catchError((error: any) => {
        console.error('Error fetching contractor sites:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all suppliers - UPDATED WITH PROPER TYPING
   */
  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<any>(`${this.apiUrl}/suppliers`).pipe(
      map((response: any) => {
        console.log('Suppliers API response:', response);
        
        // Handle different response formats
        if (Array.isArray(response)) {
          return response as Supplier[];
        } else if (response && response.data && Array.isArray(response.data)) {
          return response.data as Supplier[];
        } else if (response && response.suppliers && Array.isArray(response.suppliers)) {
          return response.suppliers as Supplier[];
        } else if (response && typeof response === 'object') {
          // Try to extract array from object values
          const values = Object.values(response);
          if (values.length > 0 && Array.isArray(values[0])) {
            return values[0] as Supplier[];
          }
        }
        
        console.warn('Suppliers API did not return an array. Response:', response);
        return [];
      }),
      catchError((error: any) => {
        console.error('Error fetching suppliers:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all materials - UPDATED WITH PROPER TYPING
   */
  getMaterials(): Observable<Material[]> {
    return this.http.get<any>(`${this.apiUrl}/materials`).pipe(
      map((response: any) => {
        console.log('Materials API response:', response);
        
        // Handle different response formats
        if (Array.isArray(response)) {
          return response as Material[];
        } else if (response && response.data && Array.isArray(response.data)) {
          return response.data as Material[];
        } else if (response && response.materials && Array.isArray(response.materials)) {
          return response.materials as Material[];
        }
        
        console.warn('Materials API did not return an array. Response:', response);
        return [];
      }),
      catchError((error: any) => {
        console.error('Error fetching materials:', error);
        return of([]);
      })
    );
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(value: number): number {
    return value * Math.PI / 180;
  }

  /**
   * Use AI to analyze site and suggest materials
   */
  async getAIMaterialSuggestions(site: Site): Promise<any[]> {
    try {
      // Mock AI response based on site type
      return this.getMockAISuggestions(site);
      
    } catch (error) {
      console.error('AI analysis failed, using fallback:', error);
      return this.getFallbackSuggestions(site.type);
    }
  }

  /**
   * Mock AI suggestions for demo
   */
  private getMockAISuggestions(site: Site): any[] {
    const siteType = site.type?.toLowerCase() || 'residential';
    
    const suggestions: { [key: string]: any[] } = {
      'residential': [
        { material: 'Cement', estimatedQuantity: 200, unit: 'bags', reason: 'For foundation and wall construction', confidence: 0.9 },
        { material: 'Sand', estimatedQuantity: 500, unit: 'tons', reason: 'For concrete mix and plastering', confidence: 0.85 },
        { material: 'Steel Bars', estimatedQuantity: 50, unit: 'tons', reason: 'Reinforcement for concrete structures', confidence: 0.8 },
        { material: 'Bricks', estimatedQuantity: 10000, unit: 'pieces', reason: 'Wall construction', confidence: 0.75 },
        { material: 'Tiles', estimatedQuantity: 500, unit: 'sqm', reason: 'Flooring and wall finishing', confidence: 0.7 }
      ],
      'commercial': [
        { material: 'Structural Steel', estimatedQuantity: 100, unit: 'tons', reason: 'Framework for commercial building', confidence: 0.9 },
        { material: 'Concrete', estimatedQuantity: 300, unit: 'cubic meters', reason: 'Foundation and slabs', confidence: 0.88 },
        { material: 'Glass Panels', estimatedQuantity: 200, unit: 'sqm', reason: 'External facade and windows', confidence: 0.8 },
        { material: 'HVAC Ducts', estimatedQuantity: 500, unit: 'meters', reason: 'Air conditioning system', confidence: 0.75 }
      ],
      'road': [
        { material: 'Asphalt', estimatedQuantity: 1000, unit: 'tons', reason: 'Road surface layer', confidence: 0.95 },
        { material: 'Road Base', estimatedQuantity: 1500, unit: 'tons', reason: 'Base layer for road', confidence: 0.9 },
        { material: 'Bitumen', estimatedQuantity: 50, unit: 'tons', reason: 'Binding material for asphalt', confidence: 0.85 },
        { material: 'Road Signs', estimatedQuantity: 20, unit: 'pieces', reason: 'Traffic control and safety', confidence: 0.7 }
      ]
    };

    return suggestions[siteType] || this.getFallbackSuggestions(site.type || 'residential');
  }

  private getFallbackSuggestions(siteType: string): any[] {
    const typeMaterials = this.materialDatabase.find(db => 
      db.type.toLowerCase() === siteType.toLowerCase()
    );
    
    if (typeMaterials) {
      return typeMaterials.materials.map(material => ({
        material,
        estimatedQuantity: 100,
        unit: this.getUnitForMaterial(material),
        reason: `Standard requirement for ${siteType} construction`,
        confidence: 0.6
      }));
    }
    
    // Default materials for unknown site types
    return [
      { material: 'Cement', estimatedQuantity: 100, unit: 'bags', reason: 'Basic construction material', confidence: 0.5 },
      { material: 'Sand', estimatedQuantity: 50, unit: 'tons', reason: 'Basic construction material', confidence: 0.5 }
    ];
  }

  private getUnitForMaterial(material: string): string {
    const units: { [key: string]: string } = {
      'Cement': 'bags',
      'Sand': 'tons',
      'Aggregate': 'tons',
      'Steel Bars': 'tons',
      'Bricks': 'pieces',
      'Tiles': 'sqm',
      'Paint': 'liters',
      'Concrete': 'cubic meters',
      'Structural Steel': 'tons',
      'Glass': 'sqm',
      'Asphalt': 'tons',
      'Bitumen': 'tons'
    };
    return units[material] || 'units';
  }

  /**
   * Get suppliers within 100km of site - UPDATED WITH SAFETY CHECK
   */
  getNearbySuppliers(site: Site, suppliers: Supplier[]): Supplier[] {
    if (!Array.isArray(suppliers)) {
      console.error('Suppliers is not an array:', suppliers);
      return [];
    }

    return suppliers.filter(supplier => {
      // Check if supplier has location data
      if (!supplier || typeof supplier !== 'object') {
        return false;
      }

      const siteLat = site.coordinates?.lat || site.latitude || 0;
      const siteLng = site.coordinates?.lng || site.longitude || 0;
      const supplierLat = supplier.latitude || supplier.coordinates?.lat || 0;
      const supplierLng = supplier.longitude || supplier.coordinates?.lng || 0;

      // Skip if coordinates are missing
      if (!siteLat || !siteLng || !supplierLat || !supplierLng) {
        return false;
      }

      const distance = this.calculateDistance(siteLat, siteLng, supplierLat, supplierLng);
      return distance <= 100 && (supplier.verified !== false); // Only verified suppliers
    });
  }

  /**
   * Send quotation request for a material
   */
  sendQuotationRequest(
    siteId: number,
    contractorId: number,
    material: any,
    supplierIds: number[]
  ): Observable<any> {
    const payload = {
      material: material.material,
      materialId: material.materialId,
      quantity: material.estimatedQuantity,
      unit: material.unit,
      siteId: siteId,
      deadline: this.getFutureDate(14), // 2 weeks deadline
      contractorId: contractorId
    };

    const queryParams = supplierIds.map(id => `supplierIds=${id}`).join('&');
    
    return this.http.post(
      `${this.apiUrl}/quotation-requests?${queryParams}`,
      payload
    ).pipe(
      catchError((error: any) => {
        console.error('Failed to send quotation:', error);
        return of({ error: true, message: error.message });
      })
    );
  }

  /**
   * Main workflow function - UPDATED WITH BETTER ERROR HANDLING
   */
  async executeSmartQuotationWorkflow(contractorId: number): Promise<any> {
    console.log('Starting smart quotation workflow for contractor:', contractorId);
    
    try {
      // 1. Get contractor's sites
      const sites = await this.getContractorSites(contractorId).toPromise();
      
      console.log('Contractor sites:', sites);
      
      if (!sites || sites.length === 0) {
        return { success: false, message: 'No sites found for contractor' };
      }

      // 2. Get all materials and suppliers in parallel
      const forkJoinResult = await forkJoin([
        this.getMaterials(),
        this.getSuppliers()
      ]).toPromise();

      const [materialsResponse, suppliersResponse] = forkJoinResult || [[], []];

      console.log('Materials response:', materialsResponse);
      console.log('Suppliers response:', suppliersResponse);

      const materials = Array.isArray(materialsResponse) ? materialsResponse : [];
      const suppliers = Array.isArray(suppliersResponse) ? suppliersResponse : [];

      console.log(`Found ${sites.length} sites, ${materials.length} materials, ${suppliers.length} suppliers`);

      const results = [];

      // 3. Process each site
      for (const site of sites) {
        console.log('Processing site:', site.name, site.id);
        
        // 4. Get AI suggestions for materials
        const aiSuggestions = await this.getAIMaterialSuggestions(site);
        
        // 5. Get nearby suppliers
        const nearbySuppliers = this.getNearbySuppliers(site, suppliers);
        
        console.log(`Found ${nearbySuppliers.length} nearby suppliers for site ${site.name}`);

        if (nearbySuppliers.length === 0) {
          console.warn(`No verified suppliers within 100km of ${site.name}`);
          continue;
        }

        // 6. Find material IDs and match with suppliers
        const materialSuggestions = aiSuggestions
          .map(suggestion => {
            const matchedMaterial = materials.find(m => 
              m && m.name && suggestion.material && 
              m.name.toLowerCase() === suggestion.material.toLowerCase()
            );
            
            if (!matchedMaterial) {
              console.log(`Material not found in database: ${suggestion.material}`);
              return null;
            }

            // Find suppliers who have this material
            const materialSuppliers = nearbySuppliers.filter(supplier => {
              // Check if supplier has materials array
              if (!supplier.materials || !Array.isArray(supplier.materials)) {
                return false;
              }
              return supplier.materials.includes(matchedMaterial.id);
            });

            return {
              ...suggestion,
              materialId: matchedMaterial.id,
              availableSuppliers: materialSuppliers.map(s => s.id),
              matchedMaterial: true
            };
          })
          .filter(item => item !== null && item.matchedMaterial && item.availableSuppliers.length > 0);

        console.log(`Found ${materialSuggestions.length} valid material suggestions for site ${site.name}`);

        results.push({
          site: site.name,
          siteId: site.id,
          siteType: site.type,
          suggestions: materialSuggestions
        });
      }

      console.log('Workflow completed. Results:', results);

      return {
        success: true,
        data: results,
        sitesCount: sites.length,
        message: `Found ${results.length} sites with materials`
      };

    } catch (error: unknown) {
      console.error('Smart quotation workflow failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      return { 
        success: false, 
        error: errorMessage,
        stack: errorStack 
      };
    }
  }

  /**
   * Send quotation requests for selected materials
   */
  async sendBulkQuotationRequests(
    contractorId: number,
    selections: Array<{
      siteId: number;
      materialId: number;
      materialName: string;
      quantity: number;
      unit: string;
      supplierIds: number[];
    }>
  ): Promise<any> {
    try {
      const requests = selections.map(selection =>
        this.sendQuotationRequest(
          selection.siteId,
          contractorId,
          {
            material: selection.materialName,
            materialId: selection.materialId,
            estimatedQuantity: selection.quantity,
            unit: selection.unit,
            reason: '',
            confidence: 0
          },
          selection.supplierIds
        )
      );

      const responses = await forkJoin(requests).toPromise();
      const safeResponses = responses || [];
      
      return {
        success: true,
        sentCount: safeResponses.filter(r => !r?.error).length,
        failedCount: safeResponses.filter(r => r?.error).length,
        responses: safeResponses
      };
    } catch (error: unknown) {
      console.error('Bulk quotation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get future date for deadline
   */
  private getFutureDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Debug method to check API endpoints
   */
  debugAPIs(): void {
    console.log('=== API Debug ===');
    console.log('Base API URL:', this.apiUrl);
    
    // Check each endpoint
    this.getSuppliers().subscribe({
      next: suppliers => console.log('Suppliers count:', suppliers.length),
      error: (err: any) => console.error('Suppliers API error:', err)
    });
    
    this.getMaterials().subscribe({
      next: materials => console.log('Materials count:', materials.length),
      error: (err: any) => console.error('Materials API error:', err)
    });
  }
}