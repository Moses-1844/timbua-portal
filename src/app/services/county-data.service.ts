// services/county-data.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface CountyData {
  [county: string]: string[]; // county name -> array of sub-counties
}

@Injectable({
  providedIn: 'root'
})
export class CountyDataService {
  private http = inject(HttpClient);

  getCountiesData() {
    return this.http.get<CountyData>('/counties-data.json'); // Adjust path as needed
  }
}