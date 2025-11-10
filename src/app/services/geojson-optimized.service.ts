/*// src/app/services/geojson-optimized.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

export interface OptimizedRestrictedZone {
  id: string;
  name: string;
  type: string;
  coordinates: number[][][];
  bufferDistance: number;
  source: 'overpass' | 'manual';
  simplified?: boolean;
}

interface GeoJSONFeature {
  type: string;
  properties: any;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  id?: string;
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

@Injectable({
  providedIn: 'root'
})
export class GeoJsonOptimizedService {
  private http = inject(HttpClient);
  private cache$: Observable<OptimizedRestrictedZone[]> | null = null;

  loadOptimizedRestrictedZones(): Observable<OptimizedRestrictedZone[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<GeoJSONData>('assets/data/restricted-zones.geojson')
        .pipe(
          map(data => this.optimizeGeoJSONData(data)),
          shareReplay(1) // Cache the result
        );
    }
    return this.cache$;
  }

  private optimizeGeoJSONData(data: GeoJSONData): OptimizedRestrictedZone[] {
    const optimizedZones: OptimizedRestrictedZone[] = [];
    const processedNames = new Set<string>();

    data.features.forEach((feature, index) => {
      try {
        const zone = this.processFeature(feature, index);
        if (zone && !processedNames.has(zone.name)) {
          optimizedZones.push(zone);
          processedNames.add(zone.name);
        }
      } catch (error) {
        console.warn('Skipping feature due to processing error:', feature.id, error);
      }
    });

    console.log(`Optimized ${data.features.length} features to ${optimizedZones.length} zones`);
    return optimizedZones;
  }

  private processFeature(feature: GeoJSONFeature, index: number): OptimizedRestrictedZone | null {
    const properties = feature.properties;
    const geometry = feature.geometry;

    // Skip if no valid geometry
    if (!geometry || !geometry.coordinates) {
      return null;
    }

    // Determine zone type and buffer distance
    const { zoneType, bufferDistance } = this.classifyZone(properties);
    
    // Get zone name
    const zoneName = this.getZoneName(properties, zoneType, index);

    // Process coordinates based on geometry type
    let coordinates: number[][][] = [];

    switch (geometry.type) {
      case 'Polygon':
        coordinates = this.simplifyPolygonCoordinates(geometry.coordinates as number[][][]);
        break;
      case 'MultiPolygon':
        coordinates = this.simplifyMultiPolygonCoordinates(geometry.coordinates as number[][][][]);
        break;
      case 'LineString':
        coordinates = this.convertLineStringToPolygon(geometry.coordinates as number[][]);
        break;
      case 'Point':
        coordinates = this.convertPointToPolygon(geometry.coordinates as number[]);
        break;
      default:
        console.warn(`Unsupported geometry type: ${geometry.type}`);
        return null;
    }

    // Skip if no valid coordinates
    if (coordinates.length === 0 || coordinates[0].length < 3) {
      return null;
    }

    return {
      id: feature.id?.toString() || `zone-${index}`,
      name: zoneName,
      type: zoneType,
      coordinates: coordinates,
      bufferDistance: bufferDistance,
      source: 'overpass',
      simplified: true
    };
  }

  private classifyZone(properties: any): { zoneType: string; bufferDistance: number } {
    const tags = properties;
    
    // Airport infrastructure
    if (tags.aeroway) {
      switch (tags.aeroway) {
        case 'aerodrome':
        case 'airport':
          return { zoneType: 'Airport', bufferDistance: 5000 };
        case 'runway':
          return { zoneType: 'Airport', bufferDistance: 3000 };
        case 'taxiway':
        case 'apron':
          return { zoneType: 'Airport', bufferDistance: 1000 };
        default:
          return { zoneType: 'Airport', bufferDistance: 2000 };
      }
    }

    // Protected areas
    if (tags.boundary === 'national_park' || tags.tourism === 'national_park') {
      return { zoneType: 'Protected Area', bufferDistance: 2000 };
    }
    if (tags.boundary === 'protected_area' || tags.leisure === 'nature_reserve') {
      return { zoneType: 'Protected Area', bufferDistance: 1500 };
    }

    // Government & Military
    if (tags.military) {
      return { zoneType: 'Military', bufferDistance: 1000 };
    }
    if (tags.government) {
      return { zoneType: 'Government', bufferDistance: 500 };
    }

    // Infrastructure
    if (tags.power === 'plant') {
      return { zoneType: 'Infrastructure', bufferDistance: 1500 };
    }
    if (tags.power === 'substation') {
      return { zoneType: 'Infrastructure', bufferDistance: 500 };
    }

    // Water bodies
    if (tags.natural === 'water') {
      return { zoneType: 'Water Body', bufferDistance: 300 };
    }

    // Default
    return { zoneType: 'Restricted Area', bufferDistance: 200 };
  }

  private getZoneName(properties: any, zoneType: string, index: number): string {
    if (properties.name) return properties.name;
    if (properties['name:en']) return properties['name:en'];
    
    // Generate descriptive names based on type and properties
    const aerowayType = properties.aeroway;
    if (aerowayType) {
      return `${aerowayType.charAt(0).toUpperCase() + aerowayType.slice(1)} ${zoneType}`;
    }
    
    return `${zoneType} ${index + 1}`;
  }

  private simplifyPolygonCoordinates(coordinates: number[][][], tolerance: number = 0.001): number[][][] {
    return coordinates.map(polygon => {
      // Reduce the number of points in the polygon
      if (polygon.length > 100) {
        return this.reducePoints(polygon, Math.ceil(polygon.length / 10));
      }
      return polygon;
    });
  }

  private simplifyMultiPolygonCoordinates(coordinates: number[][][][], tolerance: number = 0.001): number[][][] {
    const simplified: number[][][] = [];
    
    coordinates.forEach(multiPolygon => {
      multiPolygon.forEach(polygon => {
        if (polygon.length > 50) {
          simplified.push(this.reducePoints(polygon, Math.ceil(polygon.length / 8)));
        } else {
          simplified.push(polygon);
        }
      });
    });

    return simplified.length > 0 ? [simplified[0]] : []; // Take first polygon only for performance
  }

  private reducePoints(points: number[][], targetCount: number): number[][] {
    if (points.length <= targetCount) return points;
    
    const step = Math.ceil(points.length / targetCount);
    const reduced: number[][] = [];
    
    for (let i = 0; i < points.length; i += step) {
      reduced.push(points[i]);
    }
    
    // Ensure polygon is closed
    if (reduced.length > 0 && 
        (reduced[0][0] !== reduced[reduced.length-1][0] || 
         reduced[0][1] !== reduced[reduced.length-1][1])) {
      reduced.push([...reduced[0]]);
    }
    
    return reduced;
  }

  private convertLineStringToPolygon(coordinates: number[][]): number[][][] {
    if (coordinates.length < 2) return [];
    
    // Create a simple buffer around the line
    const bufferDistance = 0.001; // ~100 meters
    const polygon: number[][] = [];
    
    // Add points along one side
    coordinates.forEach(coord => {
      polygon.push([coord[0] + bufferDistance, coord[1] + bufferDistance]);
    });
    
    // Add points along the other side in reverse
    [...coordinates].reverse().forEach(coord => {
      polygon.push([coord[0] - bufferDistance, coord[1] - bufferDistance]);
    });
    
    // Close the polygon
    if (polygon.length > 0) {
      polygon.push([...polygon[0]]);
    }
    
    return [polygon];
  }

  private convertPointToPolygon(coordinates: number[]): number[][][] {
    // Create a small circle around the point
    const center = coordinates;
    const radius = 0.005; // ~500 meters
    const points: number[][] = [];
    const segments = 12;
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push([
        center[0] + radius * Math.cos(angle),
        center[1] + radius * Math.sin(angle)
      ]);
    }
    
    // Close the circle
    points.push([...points[0]]);
    
    return [points];
  }
}*/