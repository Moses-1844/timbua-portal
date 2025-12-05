import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Supplier, SupplierDocument, MaterialSite, ApiResponse } from './supplier.types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = `${environment.apiUrl}/api/suppliers`;
  private materialSitesApiUrl = `${environment.apiUrl}/api/material-sites`;

  constructor(private http: HttpClient) {}

  // Supplier CRUD Operations
  getAllSuppliers(): Observable<ApiResponse<Supplier[]>> {
    return this.http.get<ApiResponse<Supplier[]>>(this.apiUrl);
  }

  getSupplier(id: number): Observable<ApiResponse<Supplier>> {
    return this.http.get<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`);
  }

  registerSupplier(supplier: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(`${this.apiUrl}/register`, supplier);
  }

  registerSupplierWithMaterials(supplier: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(`${this.apiUrl}/register-with-materials`, supplier);
  }

  updateSupplier(id: number, supplier: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.put<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`, supplier);
  }

  verifySupplier(id: number, approve: boolean = true): Observable<ApiResponse<Supplier>> {
    const params = new HttpParams().set('approve', approve.toString());
    return this.http.put<ApiResponse<Supplier>>(`${this.apiUrl}/${id}/verify`, {}, { params });
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Supplier Documents
  getSupplierDocuments(supplierId: number): Observable<ApiResponse<SupplierDocument[]>> {
    return this.http.get<ApiResponse<SupplierDocument[]>>(`${this.apiUrl}/${supplierId}/documents`);
  }

  uploadSupplierDocument(supplierId: number, file: File): Observable<ApiResponse<SupplierDocument>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<SupplierDocument>>(`${this.apiUrl}/${supplierId}/documents`, formData);
  }

  // Material Sites CRUD Operations
  getAllMaterialSites(): Observable<MaterialSite[]> {
    return this.http.get<MaterialSite[]>(this.materialSitesApiUrl);
  }

  getMaterialSite(id: number): Observable<MaterialSite> {
    return this.http.get<MaterialSite>(`${this.materialSitesApiUrl}/${id}`);
  }

  createMaterialSite(site: Partial<MaterialSite>): Observable<MaterialSite> {
    return this.http.post<MaterialSite>(this.materialSitesApiUrl, site);
  }

  createMultipleMaterialSites(sites: MaterialSite[]): Observable<MaterialSite[]> {
    return this.http.post<MaterialSite[]>(`${this.materialSitesApiUrl}/batch`, sites);
  }

  updateMaterialSite(id: number, site: Partial<MaterialSite>): Observable<MaterialSite> {
    return this.http.put<MaterialSite>(`${this.materialSitesApiUrl}/${id}`, site);
  }

  deleteMaterialSite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.materialSitesApiUrl}/${id}`);
  }
}