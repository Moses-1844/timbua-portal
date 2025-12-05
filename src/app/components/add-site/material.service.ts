// src/app/core/services/material.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { isPlatformBrowser } from '@angular/common';

export interface Material {
  id: number;
  name: string;
  category: string;
  price: number;
  currency: string;
  unit: string;
  location: string;
  rating: number;
  contact: string;
  deliveryTime: string;
  minOrder: number;
  available: boolean;
  supplierLat: number;
  supplierLng: number;
  supplier?: any;
  createdAt: string;
  updatedAt: string;
  capacity?: number;
  availableCapacity?: number;
  description?: string;
  county?: string;
  subCounty?: string;
  owner?: string;
}

export interface ApiResponse<T> {
  data: T;
  messageCode: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: any
  ) {}

  // Get authentication token from localStorage
  getAuthToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        // Look for token in all possible keys
        const possibleTokenKeys = [
          'authToken',
          'auth_token', 
          'token', 
          'access_token', 
          'jwt_token', 
          'accessToken'
        ];
        
        // Check direct token storage first
        for (const key of possibleTokenKeys) {
          const token = localStorage.getItem(key);
          if (token && token !== 'null' && token !== 'undefined' && token !== '') {
            return token;
          }
        }
        
        // Also check if token is in user data objects
        const possibleUserKeys = ['currentUser', 'user', 'authUser', 'supplier', 'contractor'];
        for (const key of possibleUserKeys) {
          const userData = localStorage.getItem(key);
          if (userData && userData !== 'null' && userData !== 'undefined') {
            try {
              const user = JSON.parse(userData);
              const token = user.token || user.accessToken || user.jwtToken || user.access_token;
              if (token && token !== 'null' && token !== 'undefined' && token !== '') {
                return token;
              }
            } catch (e) {
              console.warn(`Failed to parse ${key} from localStorage:`, e);
            }
          }
        }
      } catch (error) {
        console.error('Error getting auth token from storage:', error);
      }
    }
    return null;
  }

  // Create headers with auth token
  private getAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
    } else {
      console.warn('No auth token found, making unauthenticated request');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
  }

  // Get supplier ID from localStorage
  getSupplierId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const possibleKeys = ['currentUser', 'supplier', 'user', 'authUser'];
        
        for (const key of possibleKeys) {
          const userData = localStorage.getItem(key);
          if (userData && userData !== 'null' && userData !== 'undefined') {
            try {
              const user = JSON.parse(userData);
              const supplierId = user.supplierId || user.id || user.userId;
              if (supplierId !== null && supplierId !== undefined && supplierId !== '') {
                return Number(supplierId);
              }
            } catch (e) {
              console.warn(`Failed to parse ${key} from localStorage:`, e);
            }
          }
        }
      } catch (error) {
        console.error('Error getting supplier ID from storage:', error);
      }
    }
    return null;
  }

  // Error handler for HTTP requests
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    console.error('HTTP Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Add material for a supplier
  addMaterial(supplierId: number, materialData: any): Observable<ApiResponse<Material>> {
    const url = `${this.apiUrl}/api/materials/supplier/${supplierId}`;
    return this.http.post<ApiResponse<Material>>(url, materialData, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get all materials for a supplier
  getSupplierMaterials(supplierId: number): Observable<ApiResponse<Material[]>> {
    const url = `${this.apiUrl}/api/materials/supplier/${supplierId}`;
    return this.http.get<ApiResponse<Material[]>>(url, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Update material
  updateMaterial(materialId: number, materialData: any): Observable<ApiResponse<Material>> {
    const url = `${this.apiUrl}/api/materials/${materialId}`;
    return this.http.put<ApiResponse<Material>>(url, materialData, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Delete material
  deleteMaterial(materialId: number): Observable<ApiResponse<string>> {
    const url = `${this.apiUrl}/api/materials/${materialId}`;
    return this.http.delete<ApiResponse<string>>(url, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get all materials (public)
  getAllMaterials(): Observable<ApiResponse<Material[]>> {
    const url = `${this.apiUrl}/api/materials`;
    return this.http.get<ApiResponse<Material[]>>(url).pipe(
      catchError(this.handleError)
    );
  }
}