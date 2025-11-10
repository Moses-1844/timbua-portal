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
  private apiUrl = `${environment.apiUrl}/material-sites`;

  getMaterials(): Observable<Material[]> {
    return this.http.get<Material[]>(this.apiUrl).pipe(
    );
  }

 

}