import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

interface LocationDetails {
  address: {
    road?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    neighbourhood?: string;
    hamlet?: string;
    municipality?: string;
  };
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
  category?: string;
  type?: string;
  name?: string;
  importance: number;
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
}

interface NaturalFeature {
  type: 'water' | 'forest' | 'mountain' | 'protected_area' | 'wetland' | 'other';
  name: string;
  distance: number; // in meters
}

interface TerrainAnalysis {
  slope: string;
  elevation: string;
  drainage: string;
  soilType: string;
  floodRisk: string;
  seismicRisk: string;
}

interface AIAnalysis {
  summary: string;
  suitability: string;
  keyConsiderations: string[];
  risks: string[];
  environmentalImpact: string;
  regulatoryRequirements: string[];
  recommendations: string[];
  estimatedTimeline: string;
  costImplications: string;
}

interface SiteAnalysisResponse {
  locationAnalysis: {
    addressDetails: any;
    naturalFeatures: NaturalFeature[];
    terrainAnalysis: string;
    accessibility: string;
    environmentalFactors: string[];
  };
  constructionAnalysis: {
    recommendations: string[];
    riskAssessment: string;
    estimatedCost: number;
    timeline: string;
    soilRecommendation: string;
    foundationType: string;
    materials: string[];
    regulatoryConsiderations: string[];
  };
  aiAnalysis: {
    summary: string;
    keyInsights: string[];
    potentialChallenges: string[];
    opportunities: string[];
  };
  metadata: {
    analyzedAt: string;
    coordinates: { lat: number; lng: number };
    buildingType: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SiteAnalysisService {
  private readonly COHERE_API_KEY = 'zU0IsKLMQLR2Lx333Bt00hLPj5ng4EY48TI0DIYm';
  private readonly COHERE_API_URL = 'https://api.cohere.ai/v2/chat';
  private readonly NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/reverse';
  private readonly OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

  constructor(private http: HttpClient) {}

  analyzeSite(
    lat: number,
    lng: number,
    projectType: string,
    estimatedCost: number,
    buildingType: string
  ): Observable<{ progress: number; step: string; data?: SiteAnalysisResponse }> {
    return new Observable(observer => {
      const performAnalysis = async () => {
        try {
          // Step 1: Get location details
          observer.next({ progress: 10, step: 'Fetching location details...' });
          const locationDetails = await this.getLocationDetails(lat, lng);

          // Step 2: Get natural features
          observer.next({ progress: 30, step: 'Analyzing natural features...' });
          const naturalFeatures = await this.getNaturalFeatures(lat, lng);

          // Step 3: Get terrain analysis
          observer.next({ progress: 50, step: 'Assessing terrain...' });
          const terrainAnalysis = await this.analyzeTerrain(lat, lng);

          // Step 4: Generate AI analysis
          observer.next({ progress: 70, step: 'Consulting Cohere AI...' });
          const aiAnalysis = await this.generateAIAnalysis(
            locationDetails,
            naturalFeatures,
            terrainAnalysis,
            projectType,
            estimatedCost,
            buildingType
          );

          // Step 5: Compile final analysis
          observer.next({ progress: 90, step: 'Generating recommendations...' });
          const analysis = this.compileAnalysis(
            locationDetails,
            naturalFeatures,
            terrainAnalysis,
            aiAnalysis,
            lat,
            lng,
            buildingType,
            estimatedCost
          );

          observer.next({ progress: 100, step: 'Analysis complete!', data: analysis });
          observer.complete();

        } catch (error) {
          console.error('Analysis error:', error);
          observer.error(error);
        }
      };

      performAnalysis();
    });
  }

  private async getLocationDetails(lat: number, lng: number): Promise<any> {
    try {
      const url = `${this.NOMINATIM_API_URL}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      // Use fetch instead of HttpClient to avoid User-Agent header issues
      const response = await fetch(url);
      const data = await response.json();

      if (data) {
        console.log('Location details fetched:', data);
        return {
          address: data.address || {},
          displayName: data.display_name,
          placeId: data.place_id,
          osmId: data.osm_id,
          osmType: data.osm_type,
          boundingBox: data.boundingbox || []
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching location details:', error);
      return null;
    }
  }

  private async getNaturalFeatures(lat: number, lng: number): Promise<NaturalFeature[]> {
    const features: NaturalFeature[] = [];
    const radius = 5000; // 5km radius

    try {
      // Query for water bodies (rivers, lakes)
      const waterQuery = `
        [out:json];
        (
          way["natural"="water"](around:${radius},${lat},${lng});
          way["waterway"="river"](around:${radius},${lat},${lng});
          way["waterway"="stream"](around:${radius},${lat},${lng});
          way["natural"="wetland"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const waterResponse = await this.http.post<any>(this.OVERPASS_API_URL, waterQuery, {
        headers: { 'Content-Type': 'text/plain' }
      }).toPromise();

      if (waterResponse?.elements) {
        waterResponse.elements.forEach((element: any) => {
          if (element.tags?.name) {
            const distance = this.calculateDistance(
              lat, lng,
              element.center?.lat || element.lat,
              element.center?.lon || element.lon
            );
            
            features.push({
              type: 'water',
              name: element.tags.name || 'Unnamed water body',
              distance: Math.round(distance)
            });
          }
        });
      }

      // Query for forests and protected areas
      const forestQuery = `
        [out:json];
        (
          way["natural"="wood"](around:${radius},${lat},${lng});
          way["landuse"="forest"](around:${radius},${lat},${lng});
          way["boundary"="protected_area"](around:${radius},${lat},${lng});
          relation["boundary"="protected_area"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const forestResponse = await this.http.post<any>(this.OVERPASS_API_URL, forestQuery, {
        headers: { 'Content-Type': 'text/plain' }
      }).toPromise();

      if (forestResponse?.elements) {
        console.log('Forest/protected area features fetched:', forestResponse.elements);
        forestResponse.elements.forEach((element: any) => {
          if (element.tags?.name) {
            const distance = this.calculateDistance(
              lat, lng,
              element.center?.lat || element.lat,
              element.center?.lon || element.lon
            );
            
            let featureType: NaturalFeature['type'] = 'forest';
            if (element.tags.boundary === 'protected_area') {
              featureType = 'protected_area';
            } else if (element.tags.natural === 'wood' || element.tags.landuse === 'forest') {
              featureType = 'forest';
            }

            features.push({
              type: featureType,
              name: element.tags.name || 'Unnamed area',
              distance: Math.round(distance)
            });
          }
        });
      }

      // Sort by distance
      features.sort((a, b) => a.distance - b.distance);
      
      return features.slice(0, 10); // Return top 10 closest features

    } catch (error) {
      console.error('Error fetching natural features:', error);
      return features; // Return whatever we have
    }
  }

  private async analyzeTerrain(lat: number, lng: number): Promise<TerrainAnalysis> {
    // For now, return mock terrain analysis
    return {
      slope: 'gentle',
      elevation: 'moderate',
      drainage: 'good',
      soilType: 'clay loam',
      floodRisk: 'low',
      seismicRisk: 'moderate'
    };
  }

  private async generateAIAnalysis(
    locationDetails: any,
    naturalFeatures: NaturalFeature[],
    terrainAnalysis: TerrainAnalysis,
    projectType: string,
    estimatedCost: number,
    buildingType: string
  ): Promise<AIAnalysis> {
    try {
      const systemMessage = `You are a construction site analysis expert with expertise in:
1. Civil engineering and construction methodologies
2. Environmental impact assessments
3. Local building codes and regulations in Kenya
4. Soil mechanics and foundation engineering
5. Risk assessment and mitigation strategies
6. Cost estimation and project management

Your task is to analyze construction sites and provide comprehensive, actionable recommendations.`;

      const userMessage = this.createAIPrompt(
        locationDetails,
        naturalFeatures,
        terrainAnalysis,
        projectType,
        estimatedCost,
        buildingType
      );

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });

      const requestBody = {
        model: 'command-a-03-2025',
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      };

      console.log('Sending request to Cohere v2 chat API:', {
        url: this.COHERE_API_URL,
        model: requestBody.model,
        messageLength: userMessage.length
      });

      const response = await this.http.post<any>(this.COHERE_API_URL, requestBody, { headers }).toPromise();
      console.log('Cohere API response:', response);

      if (response?.message?.content) {
        return this.parseAIResponse(response.message.content);
      } else if (response?.text) {
        return this.parseAIResponse(response.text);
      }

      throw new Error('No analysis generated from Cohere API');
      
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      console.error('Error details:', {
        status: (error as any).status,
        statusText: (error as any).statusText,
        message: (error as any).message
      });
      return this.getDefaultAIAnalysis();
    }
  }

  private createAIPrompt(
    locationDetails: any,
    naturalFeatures: NaturalFeature[],
    terrainAnalysis: TerrainAnalysis,
    projectType: string,
    estimatedCost: number,
    buildingType: string
  ): string {
    const address = locationDetails?.address || {};

    return `
PROJECT ANALYSIS REQUEST

Project Type: ${projectType} (${buildingType} building)
Estimated Budget: KES ${estimatedCost.toLocaleString()}

LOCATION INFORMATION:
- Coordinates: ${locationDetails?.lat || 'N/A'}, ${locationDetails?.lon || 'N/A'}
- Full Address: ${locationDetails?.displayName || 'Unknown location'}
- County: ${address.county || 'Not specified'}
- Sub-county: ${address.suburb || address.village || address.town || 'Not specified'}
- Ward: ${address.ward || 'Not specified'}
- Country: ${address.country || 'Kenya'}

NATURAL FEATURES NEARBY (within 5km):
${naturalFeatures.map(f => `- ${f.name} (${f.type}, ${f.distance}m away)`).join('\n') || 'No significant natural features detected'}

TERRAIN CHARACTERISTICS:
- Slope: ${terrainAnalysis.slope}
- Elevation: ${terrainAnalysis.elevation}
- Drainage: ${terrainAnalysis.drainage}
- Soil Type: ${terrainAnalysis.soilType}
- Flood Risk: ${terrainAnalysis.floodRisk}
- Seismic Risk: ${terrainAnalysis.seismicRisk}

ANALYSIS REQUIREMENTS:

1. SITE SUITABILITY ASSESSMENT:
   - Overall suitability rating (Excellent/Good/Moderate/Poor)
   - Key factors affecting suitability
   - Recommendations for site preparation

2. RISK ANALYSIS:
   - Primary risks (geotechnical, environmental, regulatory)
   - Risk mitigation strategies
   - Safety considerations

3. ENVIRONMENTAL CONSIDERATIONS:
   - Impact on nearby natural features
   - Required environmental safeguards
   - Sustainability recommendations

4. REGULATORY COMPLIANCE:
   - Required permits and approvals
   - Local building code requirements
   - Zoning considerations

5. CONSTRUCTION RECOMMENDATIONS:
   - Foundation type and specifications
   - Recommended construction methods
   - Material recommendations
   - Timeline estimate (considering location factors)

6. COST IMPLICATIONS:
   - How location factors affect budget
   - Cost-saving opportunities
   - Potential budget overruns

7. KEY RECOMMENDATIONS:
   - Top 5 most important actions
   - Critical success factors
   - Things to avoid

Please provide your analysis in this JSON format:
{
  "summary": "Brief 2-3 sentence overview",
  "suitability": "Rating and brief explanation",
  "keyConsiderations": ["array", "of", "key", "considerations"],
  "risks": ["array", "of", "risks", "with", "mitigation"],
  "environmentalImpact": "Detailed environmental assessment",
  "regulatoryRequirements": ["array", "of", "required", "permits"],
  "recommendations": ["array", "of", "specific", "recommendations"],
  "estimatedTimeline": "Realistic timeline estimate",
  "costImplications": "Detailed cost analysis"
}

IMPORTANT: Return ONLY valid JSON. No additional text before or after the JSON object.
`;
  }

  private parseAIResponse(text: string): AIAnalysis {
    try {
      console.log('Parsing AI response:', text.substring(0, 200) + '...');
      
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed JSON from AI response');
        return parsed;
      }
      
      // If no JSON found, try to clean up the response
      const cleanedText = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      try {
        const parsed = JSON.parse(cleanedText);
        console.log('Successfully parsed cleaned JSON');
        return parsed;
      } catch (e) {
        console.log('Could not parse as JSON, returning default analysis');
        return this.getDefaultAIAnalysis();
      }
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.getDefaultAIAnalysis();
    }
  }

  private getDefaultAIAnalysis(): AIAnalysis {
    return {
      summary: 'AI analysis could not be generated. Using default recommendations based on location data.',
      suitability: 'Moderate - Site appears suitable with standard precautions',
      keyConsiderations: [
        'Conduct detailed soil testing before foundation design',
        'Verify zoning regulations and obtain necessary permits',
        'Assess environmental impact and implement mitigation measures',
        'Check utility connections and access roads',
        'Consider drainage requirements for the site'
      ],
      risks: [
        'Standard construction risks apply - follow all safety protocols',
        'Potential for soil instability - conduct geotechnical survey',
        'Environmental regulations may require special permits',
        'Weather conditions could affect construction timeline'
      ],
      environmentalImpact: 'Standard environmental precautions needed. Consider implementing erosion control measures and protecting nearby natural features.',
      regulatoryRequirements: [
        'Building permit from county government',
        'Environmental impact assessment (if required)',
        'NEMA approval for environmental compliance',
        'Water and sewer connection approvals'
      ],
      recommendations: [
        'Use reinforced concrete foundation suitable for soil conditions',
        'Implement proper drainage system with silt traps',
        'Develop water management plan',
        'Follow Kenyan building codes and standards',
        'Consider local material availability for cost savings'
      ],
      estimatedTimeline: '12-18 months depending on site conditions and permit approvals',
      costImplications: 'Standard construction costs apply. Budget for 10-15% contingency for unexpected site conditions.'
    };
  }

  private compileAnalysis(
    locationDetails: any,
    naturalFeatures: NaturalFeature[],
    terrainAnalysis: TerrainAnalysis,
    aiAnalysis: AIAnalysis,
    lat: number,
    lng: number,
    buildingType: string,
    estimatedCost: number
  ): SiteAnalysisResponse {
    return {
      locationAnalysis: {
        addressDetails: locationDetails,
        naturalFeatures: naturalFeatures,
        terrainAnalysis: this.formatTerrainAnalysis(terrainAnalysis),
        accessibility: this.assessAccessibility(locationDetails, naturalFeatures),
        environmentalFactors: this.identifyEnvironmentalFactors(naturalFeatures)
      },
      constructionAnalysis: {
        recommendations: aiAnalysis.recommendations || [],
        riskAssessment: aiAnalysis.risks?.join('. ') || 'Standard risks apply',
        estimatedCost: estimatedCost * this.getCostMultiplier(terrainAnalysis, naturalFeatures),
        timeline: aiAnalysis.estimatedTimeline || '12-18 months',
        soilRecommendation: this.getSoilRecommendation(terrainAnalysis),
        foundationType: this.getFoundationType(terrainAnalysis, buildingType),
        materials: this.getRecommendedMaterials(buildingType),
        regulatoryConsiderations: aiAnalysis.regulatoryRequirements || []
      },
      aiAnalysis: {
        summary: aiAnalysis.summary || '',
        keyInsights: aiAnalysis.keyConsiderations || [],
        potentialChallenges: aiAnalysis.risks || [],
        opportunities: this.identifyOpportunities(locationDetails, naturalFeatures, buildingType)
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        coordinates: { lat, lng },
        buildingType: buildingType
      }
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  private formatTerrainAnalysis(terrain: TerrainAnalysis): string {
    return `Slope: ${terrain.slope}, Elevation: ${terrain.elevation}, Drainage: ${terrain.drainage}, Soil: ${terrain.soilType}, Flood Risk: ${terrain.floodRisk}, Seismic Risk: ${terrain.seismicRisk}`;
  }

  private assessAccessibility(locationDetails: any, features: NaturalFeature[]): string {
    const road = locationDetails?.address?.road;
    const hasWater = features.some(f => f.type === 'water' && f.distance < 1000);
    
    if (road) {
      return `Good road access via ${road}`;
    } else if (hasWater) {
      return 'Limited accessibility near water body. May require special access considerations.';
    }
    return 'Standard accessibility. Verify road conditions on site visit.';
  }

  private identifyEnvironmentalFactors(features: NaturalFeature[]): string[] {
    const factors: string[] = [];
    
    features.forEach(feature => {
      if (feature.distance < 500) {
        switch (feature.type) {
          case 'water':
            factors.push(`Close proximity to ${feature.name} (${feature.distance}m) - water management required`);
            break;
          case 'forest':
            factors.push(`Adjacent to ${feature.name} (${feature.distance}m) - tree preservation/transplant needed`);
            break;
          case 'protected_area':
            factors.push(`Within ${feature.distance}m of protected area ${feature.name} - special permits required`);
            break;
          case 'wetland':
            factors.push(`Near wetland area ${feature.name} (${feature.distance}m) - environmental assessment required`);
            break;
        }
      } else if (feature.distance < 2000) {
        switch (feature.type) {
          case 'water':
            factors.push(`Moderate distance to ${feature.name} (${feature.distance}m) - consider water table`);
            break;
          case 'forest':
            factors.push(`Within 2km of ${feature.name} - consider biodiversity`);
            break;
        }
      }
    });
    
    if (factors.length === 0) {
      factors.push('No significant environmental constraints within immediate vicinity');
    }
    
    return factors;
  }

  private getCostMultiplier(terrain: TerrainAnalysis, features: NaturalFeature[]): number {
    let multiplier = 1.0;
    
    // Adjust for terrain
    if (terrain.slope === 'steep') multiplier *= 1.2;
    if (terrain.floodRisk === 'high') multiplier *= 1.15;
    if (terrain.seismicRisk === 'high') multiplier *= 1.1;
    
    // Adjust for environmental factors
    const hasCloseWater = features.some(f => f.type === 'water' && f.distance < 300);
    const hasProtectedArea = features.some(f => f.type === 'protected_area' && f.distance < 500);
    const hasWetland = features.some(f => f.type === 'wetland' && f.distance < 1000);
    
    if (hasCloseWater) multiplier *= 1.1;
    if (hasProtectedArea) multiplier *= 1.25;
    if (hasWetland) multiplier *= 1.15;
    
    return Math.min(multiplier, 1.5); // Cap at 50% increase
  }

  private getSoilRecommendation(terrain: TerrainAnalysis): string {
    switch (terrain.soilType?.toLowerCase()) {
      case 'clay':
        return 'Deep foundation with proper drainage and moisture control recommended';
      case 'sand':
        return 'Raft foundation or soil stabilization with geotextiles needed';
      case 'rock':
        return 'Good bearing capacity, may require blasting or rock anchors';
      case 'loam':
        return 'Good soil conditions, standard foundation appropriate';
      default:
        return 'Comprehensive soil testing required before foundation design';
    }
  }

  private getFoundationType(terrain: TerrainAnalysis, buildingType: string): string {
    let foundation = 'Standard strip foundation';
    
    if (terrain.slope === 'steep') {
      foundation = 'Piled foundation with retaining walls';
    } else if (terrain.soilType === 'clay') {
      foundation = 'Deep strip or raft foundation with drainage';
    } else if (terrain.seismicRisk === 'high') {
      foundation = 'Earthquake-resistant foundation with base isolation';
    }
    
    if (buildingType === 'commercial' || buildingType === 'industrial') {
      foundation = 'Reinforced concrete raft foundation';
    }
    
    return foundation;
  }

  private getRecommendedMaterials(buildingType: string): string[] {
    const baseMaterials = [
      'Reinforced concrete (C25/30)',
      'Structural steel (Grade 43)',
      'Brick/block masonry',
      'Roofing materials (tiles/G.I. sheets)',
      'Waterproofing membranes',
      'Insulation materials',
      'Plumbing pipes (PVC)',
      'Electrical conduits and wiring'
    ];
    
    if (buildingType === 'commercial') {
      baseMaterials.push(
        'Glass curtain walls',
        'Elevator systems',
        'HVAC systems',
        'Fire protection systems'
      );
    } else if (buildingType === 'industrial') {
      baseMaterials.push(
        'Heavy-duty flooring',
        'Crane systems',
        'Ventilation systems',
        'Safety equipment'
      );
    } else if (buildingType === 'residential') {
      baseMaterials.push(
        'Ceramic tiles',
        'Paint and finishes',
        'Kitchen fixtures',
        'Bathroom fittings'
      );
    }
    
    return baseMaterials;
  }

  private identifyOpportunities(locationDetails: any, features: NaturalFeature[], buildingType: string): string[] {
    const opportunities: string[] = [];
    const address = locationDetails?.address || {};
    
    if (address.road) {
      opportunities.push(`Excellent road access via ${address.road}`);
    }
    
    if (address.town || address.city) {
      opportunities.push(`Proximity to urban center (${address.town || address.city}) for labor and materials`);
    }
    
    const scenicFeatures = features.filter(f => 
      (f.type === 'water' || f.type === 'forest') && f.distance < 2000
    );
    
    if (scenicFeatures.length > 0 && (buildingType === 'residential' || buildingType === 'commercial')) {
      opportunities.push(`Scenic views of ${scenicFeatures.map(f => f.name).join(', ')} for property value enhancement`);
    }
    
    // Check for construction advantages
    if (address.county?.toLowerCase().includes('nairobi') || address.county?.toLowerCase().includes('mombasa')) {
      opportunities.push('Access to skilled labor and construction materials in major urban area');
    }
    
    if (features.some(f => f.type === 'water' && f.distance < 1000)) {
      opportunities.push('Proximity to water source for construction use (with proper permits)');
    }
    
    if (opportunities.length === 0) {
      opportunities.push('Standard construction site with typical opportunities');
    }
    
    return opportunities;
  }
}