/*import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Material } from '../models/material.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/materials`;

  getMaterials(): Observable<Material[]> {
    return this.http.get<Material[]>(this.apiUrl);
  }
}*/

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Material } from '../models/material.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/materials`;

  getMaterials(): Observable<Material[]> {
    return this.http.get<Material[]>(this.apiUrl).pipe(
      // Fallback to mock data if API fails
      // catchError(() => of(this.getMockMaterials()))
    );
  }

  // Mock data based on your spreadsheet
  private getMockMaterials(): Material[] {
    return [
      {
        id: '1',
        questionnaireNo: '1',
        researchAssistantNo: '002/B1',
        name: 'Local blocks, Kokoto',
        type: ['Blocks', 'Kokoto'],
        location: {
          name: 'Mwachanda',
          latitude: -4.170327,
          longitude: 39.246377,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [
          'Some activities is seasonal hence limiting production',
          'Poor roads esp during the rainy season',
          'Flooding',
          'Lack of equipment'
        ],
        recommendations: [
          'Construction of factories to benefit the locals',
          'Price regulation of the materials'
        ],
        timestamp: new Date().toISOString()
      },
      {
        id: '2',
        questionnaireNo: '2',
        researchAssistantNo: '002/B1',
        name: 'Slabs - local tiles',
        type: ['Slabs', 'Tiles'],
        location: {
          name: 'Mwachanda',
          latitude: -4.231178,
          longitude: 39.117298,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '3',
        questionnaireNo: '3',
        researchAssistantNo: '002/B1',
        name: 'Slabs - local tiles, Hardcore blocks, Kokoto',
        type: ['Slabs', 'Tiles', 'Blocks', 'Kokoto'],
        location: {
          name: 'Gandini, South',
          latitude: -4.291798,
          longitude: 39.1483,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '4',
        questionnaireNo: '4',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks',
        type: ['Blocks'],
        location: {
          name: 'Bomani, Katindani',
          latitude: -4.249098,
          longitude: 39.160978,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '5',
        questionnaireNo: '5',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Magulani',
          latitude: -4.07713,
          longitude: 39.32258,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '6',
        questionnaireNo: '6',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Magulani',
          latitude: -4.0968,
          longitude: 39.31684,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '7',
        questionnaireNo: '7',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Chonyi',
          latitude: -4.108967,
          longitude: 39.292145,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Chonyi'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '8',
        questionnaireNo: '8',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Murungurunguni',
          latitude: -4.112138,
          longitude: 39.263447,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Chonyi'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '9',
        questionnaireNo: '9',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Nyambu',
          latitude: -4.111105,
          longitude: 39.257795,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Chonyi'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '10',
        questionnaireNo: '10',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks, Kokoto, Galana',
        type: ['Blocks', 'Rocks', 'Kokoto', 'Galana'],
        location: {
          name: 'Mwamandi',
          latitude: -4.124355,
          longitude: 39.145853,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwawesa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '11',
        questionnaireNo: '11',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Makuluni',
          latitude: -4.022363,
          longitude: 39.446792,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '12',
        questionnaireNo: '12',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Vyogato',
          latitude: -4.002562,
          longitude: 39.457288,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '13',
        questionnaireNo: '13',
        researchAssistantNo: '002/B1',
        name: 'River Sand',
        type: ['Sand'],
        location: {
          name: 'Mwache bridge',
          latitude: -3.94485,
          longitude: 39.510227,
          county: 'Mombasa',
          subCounty: 'Kisauni',
          ward: 'Mtopanga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '14',
        questionnaireNo: '14',
        researchAssistantNo: '002/B1',
        name: 'Ballast, Washed sand',
        type: ['Ballast', 'Sand'],
        location: {
          name: 'Bonje, Mwache',
          latitude: -4.002532,
          longitude: 39.536543,
          county: 'Mombasa',
          subCounty: 'Kisauni',
          ward: 'Mtopanga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '15',
        questionnaireNo: '15',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand',
        type: ['Sand'],
        location: {
          name: 'Ngeyeni',
          latitude: -3.941273,
          longitude: 39.416759,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '16',
        questionnaireNo: '16',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand',
        type: ['Sand'],
        location: {
          name: 'Maweu river',
          latitude: -3.945935,
          longitude: 39.45409,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '17',
        questionnaireNo: '17',
        researchAssistantNo: '002/B1',
        name: 'Ballast, Hardcore blocks, Maram',
        type: ['Ballast', 'Blocks', 'Maram'],
        location: {
          name: 'Mdume, kafuduni',
          latitude: -3.911902,
          longitude: 39.506902,
          county: 'Mombasa',
          subCounty: 'Kisauni',
          ward: 'Mji Wa Kale'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '18',
        questionnaireNo: '18',
        researchAssistantNo: '002/B1',
        name: 'Hardcore Blocks, Hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Mlola B',
          latitude: -3.854295,
          longitude: 39.401202,
          county: 'Kilifi',
          subCounty: 'Kilifi North',
          ward: 'Tezo'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '19',
        questionnaireNo: '19',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks, Kokoto, Galana',
        type: ['Blocks', 'Rocks', 'Kokoto', 'Galana'],
        location: {
          name: 'Julani',
          latitude: -3.834985,
          longitude: 39.374405,
          county: 'Kilifi',
          subCounty: 'Kilifi North',
          ward: 'Tezo'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '20',
        questionnaireNo: '20',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand, Hardcore blocks',
        type: ['Sand', 'Blocks'],
        location: {
          name: 'Lutsangami, Matumbi',
          latitude: -3.925768,
          longitude: 39.392367,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '21',
        questionnaireNo: '21',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand',
        type: ['Sand'],
        location: {
          name: 'Vitsaka Viri',
          latitude: -3.930928,
          longitude: 39.417397,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      },
      {
        id: '22',
        questionnaireNo: '22',
        researchAssistantNo: '002/B1',
        name: 'Ballast',
        type: ['Ballast'],
        location: {
          name: 'Mbandi',
          latitude: -4.128325,
          longitude: 39.3289,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mazeras'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      }
    ];
  }
}