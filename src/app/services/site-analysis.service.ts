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
  distance: number;
}

interface RestrictedArea {
  type: 'road' | 'railway' | 'game_park' | 'airport' | 'drainage' | 'game_reserve' | 'restricted_zone';
  name: string;
  distance: number;
  category?: string;
  restrictionLevel: 'high' | 'medium' | 'low';
  description?: string;
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
  zoningRestrictions?: string[];
  buildingLimitations?: string[];
}

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: {
    name?: string;
    type?: string;
    category?: string;
    description?: string;
    [key: string]: any;
  };
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

interface SiteAnalysisResponse {
  locationAnalysis: {
    addressDetails: any;
    naturalFeatures: NaturalFeature[];
    restrictedAreas: RestrictedArea[];
    terrainAnalysis: string;
    accessibility: string;
    environmentalFactors: string[];
    zoningRestrictions: string[];
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
    buildingLimitations: string[];
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
    isBuildable: boolean;
    restrictionsFound: number;
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
  private readonly GEOJSON_PATH = '/geoson.geojson';
  private readonly DRAINAGE_GEOJSON_PATH = '/drainage.geojson';

  private geoJsonData: GeoJSONData | null = null;
  private drainageGeoJsonData: GeoJSONData | null = null;

  constructor(private http: HttpClient) {
    this.loadGeoJSONData();
  }

  private async loadGeoJSONData(): Promise<void> {
    try {
      // Load both GeoJSON files in parallel
      const [geosonData, drainageData] = await Promise.all([
        this.http.get<GeoJSONData>(this.GEOJSON_PATH).toPromise(),
        this.http.get<GeoJSONData>(this.DRAINAGE_GEOJSON_PATH).toPromise()
      ]);
      
      this.geoJsonData = geosonData || null;
      this.drainageGeoJsonData = drainageData || null;
      console.log('Both GeoJSON files loaded successfully');
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
    }
  }

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
          console.log('Location details:', locationDetails);

          // Step 2: Get natural features
          observer.next({ progress: 20, step: 'Analyzing natural features...' });
          const naturalFeatures = await this.getNaturalFeatures(lat, lng).catch(error => {
            console.warn('Natural features fetch failed:', error);
            return [];
          });

          // Step 3: Check restricted areas
          observer.next({ progress: 35, step: 'Checking for restricted areas...' });
          const restrictedAreas = await this.getRestrictedAreas(lat, lng);

          // Step 4: Get terrain analysis
          observer.next({ progress: 50, step: 'Assessing terrain and drainage...' });
          const terrainAnalysis = await this.analyzeTerrain(lat, lng, restrictedAreas);

          // Step 5: Check if site is buildable
          observer.next({ progress: 60, step: 'Evaluating buildability...' });
          const isBuildable = this.evaluateBuildability(restrictedAreas, terrainAnalysis);

          // Step 6: Generate AI analysis
          observer.next({ progress: 70, step: 'Consulting AI for recommendations...' });
          const aiAnalysis = await this.generateAIAnalysis(
            locationDetails,
            naturalFeatures,
            restrictedAreas,
            terrainAnalysis,
            projectType,
            estimatedCost,
            buildingType,
            isBuildable
          );

          // Step 7: Compile final analysis
          observer.next({ progress: 90, step: 'Generating comprehensive report...' });
          const analysis = this.compileAnalysis(
            locationDetails,
            naturalFeatures,
            restrictedAreas,
            terrainAnalysis,
            aiAnalysis,
            lat,
            lng,
            buildingType,
            estimatedCost,
            isBuildable
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
      const response = await fetch(url);
      const data = await response.json();

      if (data) {
        return {
          address: data.address || {},
          displayName: data.display_name,
          placeId: data.place_id,
          osmId: data.osm_id,
          osmType: data.osm_type,
          boundingBox: data.boundingbox || [],
          lat: data.lat,
          lon: data.lon
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
    const radius = 2000;

    try {
      const simpleQuery = `
        [out:json][timeout:25];
        (
          node["natural"="water"](around:${radius},${lat},${lng});
          node["waterway"](around:${radius},${lat},${lng});
          node["landuse"="forest"](around:${radius},${lat},${lng});
          node["boundary"="protected_area"](around:${radius},${lat},${lng});
        );
        out body;
      `;

      const response = await this.http.post<any>(this.OVERPASS_API_URL, simpleQuery, {
        headers: { 'Content-Type': 'text/plain' }
      }).toPromise();

      if (response?.elements) {
        response.elements.forEach((element: any) => {
          if (element.tags?.name || element.tags?.natural || element.tags?.waterway) {
            const distance = this.calculateDistance(
              lat, lng,
              element.lat,
              element.lon
            );
            
            let featureType: NaturalFeature['type'] = 'other';
            let featureName = 'Unnamed feature';
            
            if (element.tags.natural === 'water' || element.tags.waterway) {
              featureType = 'water';
              featureName = element.tags.name || element.tags.waterway || 'Water body';
            } else if (element.tags.landuse === 'forest' || element.tags.natural === 'wood') {
              featureType = 'forest';
              featureName = element.tags.name || 'Forest area';
            } else if (element.tags.boundary === 'protected_area') {
              featureType = 'protected_area';
              featureName = element.tags.name || 'Protected area';
            }

            features.push({
              type: featureType,
              name: featureName,
              distance: Math.round(distance)
            });
          }
        });
      }

      // Sort by distance
      features.sort((a, b) => a.distance - b.distance);
      return features.slice(0, 5);

    } catch (error) {
      console.warn('Error fetching natural features:', error);
      return [];
    }
  }

  private async getRestrictedAreas(lat: number, lng: number): Promise<RestrictedArea[]> {
    const restrictedAreas: RestrictedArea[] = [];
    const searchRadius = 5000; // 5km search radius

    // Check both GeoJSON files
    const allFeatures = [
      ...(this.geoJsonData?.features || []),
      ...(this.drainageGeoJsonData?.features || [])
    ];

    allFeatures.forEach((feature: GeoJSONFeature) => {
      const distance = this.calculateDistanceToFeature(lat, lng, feature);
      
      if (distance <= searchRadius) {
        const areaInfo = this.determineAreaType(feature);
        if (areaInfo) {
          restrictedAreas.push({
            type: areaInfo.type,
            name: feature.properties.name || areaInfo.defaultName,
            distance: Math.round(distance),
            category: feature.properties.category || feature.properties.type,
            restrictionLevel: areaInfo.restrictionLevel,
            description: feature.properties.description
          });
        }
      }
    });

    // Sort by restriction level (high to low) then by distance
    restrictedAreas.sort((a, b) => {
      const priorityA = this.getRestrictionPriority(a.restrictionLevel);
      const priorityB = this.getRestrictionPriority(b.restrictionLevel);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.distance - b.distance;
    });

    return restrictedAreas;
  }

  private calculateDistanceToFeature(lat: number, lng: number, feature: GeoJSONFeature): number {
    // Calculate distance to the closest point in the geometry
    let minDistance = Infinity;
    
    const getCoords = (geometry: any): [number, number][] => {
      if (geometry.type === 'Point') {
        return [geometry.coordinates];
      } else if (geometry.type === 'LineString') {
        return geometry.coordinates;
      } else if (geometry.type === 'Polygon') {
        return geometry.coordinates[0]; // Outer ring
      } else if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates[0][0]; // First polygon's outer ring
      }
      return [];
    };

    const coords = getCoords(feature.geometry);
    
    for (const coord of coords) {
      const [coordLng, coordLat] = coord;
      const distance = this.calculateDistance(lat, lng, coordLat, coordLng);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    return minDistance;
  }

private determineAreaType(feature: GeoJSONFeature): { type: RestrictedArea['type'], defaultName: string, restrictionLevel: 'high' | 'medium' | 'low' } | null {
  const properties = feature.properties;
  const name = (properties?.name || '').toLowerCase();
  const type = (properties?.type || '').toLowerCase();
  const category = (properties?.category || '').toLowerCase();
  const aeroway = (properties?.['aeroway'] || '').toLowerCase();
  const natural = (properties?.['natural'] || '').toLowerCase();
  
  // Debug logging
  console.log('Feature properties:', properties);
  console.log('Checking area type:', { name, type, category, aeroway, natural });

  // Check for drainage/water features
  if (type === 'drainage' || 
      category === 'drainage' ||
      type === 'water' ||
      natural === 'water' ||
      name.includes('river') ||
      name.includes('lake') ||
      name.includes('stream') ||
      name.includes('wetland') ||
      name.includes('water')) {
    console.log('Detected drainage feature:', name);
    return { 
      type: 'drainage', 
      defaultName: 'Water/Drainage Feature',
      restrictionLevel: 'high' 
    };
  }
  
  // Check for airports and airstrips
  if (aeroway === 'airport' || 
      aeroway === 'runway' || 
      aeroway === 'taxiway' ||
      aeroway === 'apron' ||
      type === 'airport' ||
      name.includes('airport') ||
      name.includes('airstrip') ||
      name.includes('airfield')) {
    console.log('Detected airport feature:', name);
    return { 
      type: 'airport', 
      defaultName: 'Airport/Airstrip',
      restrictionLevel: 'high' 
    };
  }
  
  // Check for roads
  if (type === 'road' || 
      type === 'highway' ||
      category === 'road' ||
      category === 'highway' ||
      name.includes('road') ||
      name.includes('highway')) {
    console.log('Detected road feature:', name);
    return { 
      type: 'road', 
      defaultName: 'Road',
      restrictionLevel: 'medium' 
    };
  }
  
  // Check for railways
  if (type === 'rail' || 
      type === 'railway' ||
      category === 'rail' ||
      category === 'railway' ||
      name.includes('rail') ||
      name.includes('railway')) {
    console.log('Detected railway feature:', name);
    return { 
      type: 'railway', 
      defaultName: 'Railway',
      restrictionLevel: 'high' 
    };
  }
  
  // Check for game parks and reserves
  if (type === 'game_park' || 
      type === 'game_reserve' ||
      type === 'national_park' ||
      category === 'protected_area' ||
      name.includes('park') ||
      name.includes('reserve') ||
      name.includes('conservancy') ||
      name.includes('national park')) {
    console.log('Detected protected area:', name);
    return { 
      type: type === 'game_reserve' || name.includes('reserve') ? 'game_reserve' : 'game_park', 
      defaultName: 'Protected Area',
      restrictionLevel: 'high' 
    };
  }
  
  console.log('No matching area type found for feature');
  return null;
}

  private getRestrictionPriority(level: 'high' | 'medium' | 'low'): number {
    switch(level) {
      case 'high': return 1;
      case 'medium': return 2;
      case 'low': return 3;
      default: return 3;
    }
  }

  private async analyzeTerrain(lat: number, lng: number, restrictedAreas: RestrictedArea[]): Promise<TerrainAnalysis> {
    // Enhanced terrain analysis considering drainage features
    const hasNearbyDrainage = restrictedAreas.some(area => 
      area.type === 'drainage' && area.distance < 500
    );
    
    const hasProtectedArea = restrictedAreas.some(area => 
      (area.type === 'game_park' || area.type === 'game_reserve') && area.distance < 2000
    );

    // Mock terrain analysis - in production, integrate with terrain APIs
    return {
      slope: 'gentle',
      elevation: 'moderate',
      drainage: hasNearbyDrainage ? 'poor' : 'good',
      soilType: 'clay loam',
      floodRisk: hasNearbyDrainage ? 'high' : 'low',
      seismicRisk: 'moderate'
    };
  }

  private evaluateBuildability(restrictedAreas: RestrictedArea[], terrain: TerrainAnalysis): boolean {
    // Check for critical restrictions
    const criticalRestrictions = restrictedAreas.filter(area => 
      area.restrictionLevel === 'high' && area.distance < 100
    );
    
    // Check terrain suitability
    const unsuitableTerrain = terrain.floodRisk === 'high' || terrain.drainage === 'poor';
    
    // Site is buildable if no critical restrictions and terrain is suitable
    return criticalRestrictions.length === 0 && !unsuitableTerrain;
  }

  private async generateAIAnalysis(
    locationDetails: any,
    naturalFeatures: NaturalFeature[],
    restrictedAreas: RestrictedArea[],
    terrainAnalysis: TerrainAnalysis,
    projectType: string,
    estimatedCost: number,
    buildingType: string,
    isBuildable: boolean
  ): Promise<AIAnalysis> {
    try {
      const systemMessage = `You are a construction site analysis expert specializing in Kenyan building regulations. Analyze construction sites and provide detailed recommendations in JSON format only. Consider NEMA regulations, county building codes, and environmental impact assessments.`;

      const userMessage = this.createAIPrompt(
        locationDetails,
        naturalFeatures,
        restrictedAreas,
        terrainAnalysis,
        projectType,
        estimatedCost,
        buildingType,
        isBuildable
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
        max_tokens: 2000,
      };

      const response = await this.http.post<any>(this.COHERE_API_URL, requestBody, { headers }).toPromise();
      return this.parseAIResponse(response);
      
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return this.getDefaultAIAnalysis(restrictedAreas, isBuildable);
    }
  }

  private createAIPrompt(
    locationDetails: any,
    naturalFeatures: NaturalFeature[],
    restrictedAreas: RestrictedArea[],
    terrainAnalysis: TerrainAnalysis,
    projectType: string,
    estimatedCost: number,
    buildingType: string,
    isBuildable: boolean
  ): string {
    const address = locationDetails?.address || {};
    const displayName = locationDetails?.displayName || 'Unknown location';

    // Format restricted areas
    const restrictedAreasText = restrictedAreas.length > 0 
      ? restrictedAreas.map(area => 
          `- ${area.name} (${area.type}, ${area.distance}m, ${area.restrictionLevel} restriction)`
        ).join('\n')
      : 'No restricted areas found within 5km';

    return `
COMPREHENSIVE CONSTRUCTION SITE ANALYSIS FOR KENYA:

Project Details:
- Project: ${projectType} (${buildingType})
- Budget: KES ${estimatedCost.toLocaleString()}
- Location: ${displayName}
- County: ${address.county || 'Nairobi'}
- Area: ${address.suburb || address.neighbourhood || 'Urban area'}

RESTRICTED AREAS WITHIN 5KM (CRITICAL FOR ANALYSIS):
${restrictedAreasText}

Buildability Status: ${isBuildable ? '✅ BUILDABLE (with conditions)' : '❌ NOT BUILDABLE (critical restrictions found)'}

Natural Features Nearby:
${naturalFeatures.map(f => `- ${f.name} (${f.type}, ${f.distance}m)`).join('\n')}

Site Conditions:
- Slope: ${terrainAnalysis.slope}
- Soil: ${terrainAnalysis.soilType}
- Drainage: ${terrainAnalysis.drainage}
- Flood Risk: ${terrainAnalysis.floodRisk}
- Seismic Risk: ${terrainAnalysis.seismicRisk}

IMPORTANT: Provide specific Kenyan regulatory requirements and environmental considerations.

RETURN JSON ONLY in this exact format:
{
  "summary": "Brief overview including buildability status",
  "suitability": "Rating (High/Medium/Low) and explanation",
  "keyConsiderations": ["Consideration 1", "Consideration 2", "Consideration 3"],
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "environmentalImpact": "Environmental assessment considering nearby features",
  "regulatoryRequirements": ["Permit 1", "Permit 2", "Permit 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "estimatedTimeline": "Timeline estimate considering regulations",
  "costImplications": "Cost analysis including mitigation measures",
  "zoningRestrictions": ["Restriction 1", "Restriction 2"],
  "buildingLimitations": ["Limitation 1", "Limitation 2"]
}
`;
  }

private parseAIResponse(response: any): AIAnalysis {
  console.log('Starting parseAIResponse with:', response);
  
  try {
    // Try to extract text content from different response formats
    let textContent = '';
    
    if (typeof response === 'string') {
      textContent = response;
    } else if (response?.message?.content) {
      textContent = response.message.content;
    } else if (response?.content) {
      textContent = response.content;
    } else if (response?.text) {
      textContent = response.text;
    } else if (response?.generations?.[0]?.text) {
      textContent = response.generations[0].text;
    } else {
      // Try to stringify the response to see what we have
      textContent = JSON.stringify(response);
    }
    
    console.log('Text content extracted:', textContent);

    // Try to find JSON in the response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed JSON:', parsed);
        return parsed;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
      }
    }

    // Try to clean the text and parse
    const cleanedText = textContent
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/^[^{]*/, '') // Remove everything before first {
      .replace(/[^}]*$/, '') // Remove everything after last }
      .trim();

    if (cleanedText) {
      try {
        const parsed = JSON.parse(cleanedText);
        console.log('Successfully parsed cleaned JSON:', parsed);
        return parsed;
      } catch (e) {
        console.error('Cleaned JSON parse error:', e);
      }
    }

    // If we can't parse JSON, extract information from text
    console.log('Could not parse as JSON, extracting from text');
    return this.extractAnalysisFromText(textContent);
    
  } catch (error) {
    console.error('Error in parseAIResponse:', error);
    return this.getDefaultAIAnalysis([], true);
  }
}

private extractAnalysisFromText(text: string): AIAnalysis {
  const analysis: AIAnalysis = {
    summary: '',
    suitability: 'Moderate',
    keyConsiderations: [],
    risks: [],
    environmentalImpact: '',
    regulatoryRequirements: [],
    recommendations: [],
    estimatedTimeline: '12-18 months',
    costImplications: '',
    zoningRestrictions: [],
    buildingLimitations: []
  };

  // Extract first paragraph as summary
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    analysis.summary = lines[0].substring(0, 200);
  }

  // Look for bullet points or numbered lists
  const bulletPoints = text.match(/(- |• |\d+\.\s)(.+?)(?=\n|$)/g);
  if (bulletPoints) {
    analysis.recommendations = bulletPoints
      .map(bp => bp.replace(/^(- |• |\d+\.\s)/, '').trim())
      .slice(0, 5);
  }

  // Look for risk indicators
  if (text.toLowerCase().includes('risk') || text.toLowerCase().includes('challenge')) {
    analysis.risks = ['Standard construction risks apply'];
  }

  // Look for zoning restrictions
  if (text.toLowerCase().includes('zoning') || text.toLowerCase().includes('restrict')) {
    analysis.zoningRestrictions = ['Verify with local county zoning regulations'];
  }

  // Look for regulatory mentions
  if (text.toLowerCase().includes('permit') || text.toLowerCase().includes('approval')) {
    analysis.regulatoryRequirements = ['Building permit required', 'County approval needed'];
  }

  return analysis;
}

  private getDefaultAIAnalysis(restrictedAreas: RestrictedArea[], isBuildable: boolean): AIAnalysis {
    const hasCriticalRestrictions = restrictedAreas.some(area => 
      area.restrictionLevel === 'high' && area.distance < 100
    );
    
    const analysis: AIAnalysis = {
      summary: isBuildable 
        ? 'Site analysis completed. The location appears suitable for construction with standard precautions and regulatory compliance.'
        : 'Site analysis completed. Critical restrictions found - construction may not be permitted or requires special approvals.',
      suitability: isBuildable ? 'Moderate - Requires compliance with regulations' : 'Low - Critical restrictions present',
      keyConsiderations: [
        'Verify soil conditions with geotechnical survey',
        'Obtain necessary building permits from county government',
        'Consider drainage requirements and flood mitigation',
        'Plan for utility connections'
      ],
      risks: hasCriticalRestrictions 
        ? [
            'Proximity to restricted areas may require special permits',
            'Environmental impact assessment required',
            'Potential for regulatory delays',
            'Additional mitigation costs'
          ]
        : [
            'Standard construction risks',
            'Potential for soil variations',
            'Weather-related delays'
          ],
      environmentalImpact: 'Environmental impact assessment required. Follow NEMA guidelines and county environmental regulations.',
      regulatoryRequirements: [
        'Building permit from county government',
        'NEMA EIA license (if required)',
        'Water and sewer connection approvals',
        'Environmental audit certificate'
      ],
      recommendations: [
        'Conduct thorough site survey including restricted area assessment',
        'Use reinforced concrete foundation with proper drainage',
        'Follow Kenyan building codes (KS 02-1070)',
        'Hire qualified local contractors with NCA registration',
        'Install proper erosion control measures'
      ],
      estimatedTimeline: hasCriticalRestrictions ? '18-24 months (including approval time)' : '12-16 months',
      costImplications: hasCriticalRestrictions 
        ? 'Budget 20-30% contingency for mitigation measures and regulatory compliance'
        : 'Standard urban construction costs. Budget 10-15% contingency.',
      zoningRestrictions: restrictedAreas.length > 0 
        ? restrictedAreas.map(area => `${area.type} within ${area.distance}m - ${area.restrictionLevel} restriction`)
        : ['No zoning restrictions identified'],
      buildingLimitations: hasCriticalRestrictions
        ? ['Height restrictions may apply', 'Limited excavation depth', 'Special foundation requirements']
        : ['Standard building limitations apply']
    };

    return analysis;
  }

  private compileAnalysis(
    locationDetails: any,
    naturalFeatures: NaturalFeature[],
    restrictedAreas: RestrictedArea[],
    terrainAnalysis: TerrainAnalysis,
    aiAnalysis: AIAnalysis,
    lat: number,
    lng: number,
    buildingType: string,
    estimatedCost: number,
    isBuildable: boolean
  ): SiteAnalysisResponse {
    return {
      locationAnalysis: {
        addressDetails: locationDetails,
        naturalFeatures: naturalFeatures,
        restrictedAreas: restrictedAreas,
        terrainAnalysis: this.formatTerrainAnalysis(terrainAnalysis),
        accessibility: this.assessAccessibility(locationDetails, naturalFeatures, restrictedAreas),
        environmentalFactors: this.identifyEnvironmentalFactors(naturalFeatures, restrictedAreas),
        zoningRestrictions: aiAnalysis.zoningRestrictions || []
      },
      constructionAnalysis: {
        recommendations: aiAnalysis.recommendations || [],
        riskAssessment: aiAnalysis.risks?.join('. ') || 'Standard risks apply',
        estimatedCost: estimatedCost * this.getCostMultiplier(terrainAnalysis, restrictedAreas),
        timeline: aiAnalysis.estimatedTimeline || '12-18 months',
        soilRecommendation: this.getSoilRecommendation(terrainAnalysis),
        foundationType: this.getFoundationType(terrainAnalysis, buildingType, restrictedAreas),
        materials: this.getRecommendedMaterials(buildingType, restrictedAreas),
        regulatoryConsiderations: aiAnalysis.regulatoryRequirements || [],
        buildingLimitations: aiAnalysis.buildingLimitations || []
      },
      aiAnalysis: {
        summary: aiAnalysis.summary || '',
        keyInsights: aiAnalysis.keyConsiderations || [],
        potentialChallenges: aiAnalysis.risks || [],
        opportunities: this.identifyOpportunities(locationDetails, naturalFeatures, buildingType, isBuildable)
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        coordinates: { lat, lng },
        buildingType: buildingType,
        isBuildable: isBuildable,
        restrictionsFound: restrictedAreas.length
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

  private assessAccessibility(locationDetails: any, naturalFeatures: NaturalFeature[], restrictedAreas: RestrictedArea[]): string {
    const address = locationDetails?.address || {};
    const roadRestrictions = restrictedAreas.filter(area => area.type === 'road' && area.distance < 200);
    
    if (roadRestrictions.length > 0) {
      return `Limited access - roads restricted within ${roadRestrictions[0].distance}m`;
    }
    
    if (address.road) {
      return `Good road access via ${address.road}`;
    } else if (address.suburb || address.neighbourhood) {
      return `Urban location in ${address.suburb || address.neighbourhood}`;
    }
    return 'Standard urban accessibility';
  }

  private identifyEnvironmentalFactors(naturalFeatures: NaturalFeature[], restrictedAreas: RestrictedArea[]): string[] {
    const factors: string[] = [];
    
    // Add natural features
    naturalFeatures.forEach(feature => {
      if (feature.distance < 500) {
        factors.push(`${feature.type} within 500m: ${feature.name}`);
      }
    });
    
    // Add restricted areas as environmental factors
    restrictedAreas.forEach(area => {
      if (area.distance < 1000 && (area.type === 'game_park' || area.type === 'game_reserve' || area.type === 'drainage')) {
        factors.push(`${area.type.replace('_', ' ')} within 1km: ${area.name} (${area.restrictionLevel} restriction)`);
      }
    });
    
    if (factors.length === 0) {
      factors.push('No significant environmental constraints nearby');
    }
    
    return factors;
  }

  private getCostMultiplier(terrain: TerrainAnalysis, restrictedAreas: RestrictedArea[]): number {
    let multiplier = 1.0;
    
    if (terrain.slope === 'steep') multiplier *= 1.1;
    if (terrain.floodRisk === 'high') multiplier *= 1.2;
    if (terrain.drainage === 'poor') multiplier *= 1.15;
    
    // Add cost for mitigation of restricted areas
    const highRestrictions = restrictedAreas.filter(area => 
      area.restrictionLevel === 'high' && area.distance < 500
    ).length;
    
    multiplier *= (1 + (highRestrictions * 0.1));
    
    return multiplier;
  }

  private getSoilRecommendation(terrain: TerrainAnalysis): string {
    switch (terrain.soilType?.toLowerCase()) {
      case 'clay':
        return 'Reinforced foundation with proper drainage and soil stabilization';
      case 'sand':
        return 'Raft foundation with soil stabilization and drainage';
      case 'loam':
        return 'Strip foundation with proper drainage system';
      default:
        return 'Geotechnical survey required - standard foundation with soil testing';
    }
  }

  private getFoundationType(terrain: TerrainAnalysis, buildingType: string, restrictedAreas: RestrictedArea[]): string {
    const hasNearbyDrainage = restrictedAreas.some(area => 
      area.type === 'drainage' && area.distance < 200
    );
    
    if (hasNearbyDrainage) {
      return 'Piled foundation with waterproofing';
    }
    
    if (terrain.slope === 'steep') {
      return 'Piled or reinforced foundation';
    }
    
    if (buildingType === 'commercial' || buildingType === 'industrial') {
      return 'Reinforced concrete raft foundation';
    }
    
    if (terrain.floodRisk === 'high') {
      return 'Elevated foundation with proper drainage';
    }
    
    return 'Strip foundation with damp proof course';
  }

  private getRecommendedMaterials(buildingType: string, restrictedAreas: RestrictedArea[]): string[] {
    const materials = [
      'Reinforced concrete',
      'Structural steel',
      'Brick/block masonry',
      'Roofing materials (approved by county)',
      'Waterproofing membrane',
      'PVC plumbing pipes',
      'Copper electrical wiring'
    ];
    
    if (buildingType === 'commercial') {
      materials.push('Glass facades', 'HVAC systems', 'Fire safety systems');
    }
    
    // Add environmental considerations
    if (restrictedAreas.some(area => area.type === 'game_park' || area.type === 'game_reserve')) {
      materials.push('Eco-friendly materials', 'Noise reduction materials');
    }
    
    return materials;
  }

  private identifyOpportunities(locationDetails: any, naturalFeatures: NaturalFeature[], buildingType: string, isBuildable: boolean): string[] {
    const opportunities: string[] = [];
    const address = locationDetails?.address || {};
    
    if (isBuildable) {
      opportunities.push('Site is buildable with standard approvals');
    }
    
    if (address.road) {
      opportunities.push(`Good road access via ${address.road}`);
    }
    
    if (address.suburb || address.city) {
      opportunities.push(`Urban location in ${address.suburb || address.city}`);
    }
    
    if (naturalFeatures.some(f => f.type === 'forest' && f.distance < 1000)) {
      opportunities.push('Proximity to green spaces for environmental credits');
    }
    
    if (opportunities.length === 0) {
      opportunities.push('Standard urban construction site with development potential');
    }
    
    return opportunities;
  }
}