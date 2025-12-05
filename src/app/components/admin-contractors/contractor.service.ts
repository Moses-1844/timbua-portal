import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Contractor, Document, Site } from './contractor.types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractorService {
  private apiUrl = `${environment.apiUrl}/api/contractors`;
  private sitesApiUrl = `${environment.apiUrl}/api/sites`;

  constructor(private http: HttpClient) {}

  getAllContractors(): Observable<Contractor[]> {
    return this.http.get<Contractor[]>(this.apiUrl);
  }

  getContractor(id: number): Observable<Contractor> {
    return this.http.get<Contractor>(`${this.apiUrl}/${id}`);
  }

  registerContractor(contractor: any): Observable<Contractor> {
    return this.http.post<Contractor>(`${this.apiUrl}/register`, contractor);
  }

  verifyContractor(id: number, approved: boolean): Observable<Contractor> {
    const params = new HttpParams().set('approved', approved.toString());
    return this.http.put<Contractor>(`${this.apiUrl}/${id}/verify`, {}, { params });
  }

  deleteContractor(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateContractor(id: number, contractor: Contractor): Observable<Contractor> {
    return this.http.put<Contractor>(`${this.apiUrl}/${id}`, contractor);
  }

  getContractorDocuments(contractorId: number): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/${contractorId}/documents`);
  }

  updateDocumentStatus(documentId: number, status: string): Observable<Document> {
    const params = new HttpParams().set('status', status);
    return this.http.put<Document>(`${this.apiUrl}/documents/${documentId}/status`, {}, { params });
  }

  getAllSites(): Observable<Site[]> {
    return this.http.get<Site[]>(this.sitesApiUrl);
  }

  getSitesByContractor(contractorId: number): Observable<Site[]> {
    return this.http.get<Site[]>(this.sitesApiUrl).pipe(
      map((sites: Site[]) => sites.filter(site => site.contractor?.id === contractorId))
    );
  }

  createSite(site: Site): Observable<Site> {
    return this.http.post<Site>(this.sitesApiUrl, site);
  }

  updateSite(id: number, site: Site): Observable<Site> {
    return this.http.put<Site>(`${this.sitesApiUrl}/${id}`, site);
  }

  deleteSite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.sitesApiUrl}/${id}`);
  }
}