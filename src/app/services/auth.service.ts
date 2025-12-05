import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  role: 'CONTRACTOR' | 'SUPPLIER' | 'SUPER_ADMIN' | 'REGULATOR';
  token: string;
  contractor?: any;
  supplier?: any;
}

interface LogoutResponse {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private _isAuthenticated = false;
  private _role: string | null = null;
  private _userData: any = null;

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  // Getters
  get isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  get role(): string | null {
    return this._role;
  }

  get userData(): any {
    return this._userData;
  }

  // Token management
  get token(): string | null {
    return localStorage.getItem('authToken');
  }

  getAuthToken(): string | null {
    return this.token;
  }

  // Get authorization headers for HTTP requests
  getAuthHeaders(): { [header: string]: string } {
    const token = this.getAuthToken();
    return token ? { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : { 'Content-Type': 'application/json' };
  }

  // Login with backend API - FIXED METHOD SIGNATURE
  login(email: string, password: string): Observable<LoginResponse> {
    const credentials: LoginCredentials = { email, password };
    
    // FIXED: Correct API endpoint URL
    return this.http.post<LoginResponse>(`${this.apiUrl}/api/auth/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success) {
            this.handleSuccessfulLogin(response);
          } else {
            this.handleFailedLogin();
          }
        }),
        catchError(error => {
          this.handleFailedLogin();
          throw error;
        })
      );
  }

  private handleSuccessfulLogin(response: LoginResponse): void {
    this._isAuthenticated = true;
    this._role = response.role;

    // Save token
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      console.log('Token saved to localStorage');
    }

    // Save user data based on role
    let userData: any = {
      email: this.getEmailFromResponse(response),
      role: response.role
    };

    switch (response.role) {
      case 'CONTRACTOR':
        if (response.contractor) {
          userData = {
            ...userData,
            id: response.contractor.id,
            contractorId: response.contractor.id,
            companyName: response.contractor.companyName,
            contactPerson: response.contractor.contactPerson,
            isVerified: response.contractor.isVerified,
            status: response.contractor.status,
            email: response.contractor.email,
            phoneNumber: response.contractor.phoneNumber,
            specialization: response.contractor.specialization
          };
          localStorage.setItem('contractor', JSON.stringify(response.contractor));
        }
        break;

      case 'SUPPLIER':
        if (response.supplier) {
          userData = {
            ...userData,
            id: response.supplier.id,
            supplierId: response.supplier.id,
            companyName: response.supplier.companyName,
            contactPerson: response.supplier.contactPerson,
            verified: response.supplier.verified,
            status: response.supplier.status,
            email: response.supplier.email,
            phoneNumber: response.supplier.phoneNumber,
            businessType: response.supplier.businessType
          };
          localStorage.setItem('supplier', JSON.stringify(response.supplier));
        }
        break;

      case 'SUPER_ADMIN':
        userData = {
          ...userData,
          id: 'super_admin',
          isSuperAdmin: true
        };
        break;

      case 'REGULATOR':
        userData = {
          ...userData,
          id: 'regulator',
          isRegulator: true
        };
        break;
    }

    this._userData = userData;
    localStorage.setItem('currentUser', JSON.stringify(userData));
    
    console.log('Login successful:', { 
      role: response.role, 
      userId: this.getCurrentUserId(),
      token: this.token ? 'Token present' : 'No token'
    });
  }

  private getEmailFromResponse(response: LoginResponse): string {
    if (response.contractor) {
      return response.contractor.email;
    }
    if (response.supplier) {
      return response.supplier.email;
    }
    return '';
  }

  private handleFailedLogin(): void {
    this._isAuthenticated = false;
    this._role = null;
    this._userData = null;
    this.clearLocalStorage();
  }

  // Logout with backend API
  logout(): Observable<LogoutResponse> {
    const token = this.token;
    this.clearSession();

    if (token) {
      // FIXED: Correct API endpoint URL
      return this.http.post<LogoutResponse>(`${this.apiUrl}/api/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).pipe(
        tap(response => {
          console.log('Logout successful:', response.message);
          this.router.navigate(['/login']);
        }),
        catchError(error => {
          console.error('Logout error:', error);
          this.router.navigate(['/login']);
          return of({ success: true, message: 'Logged out locally' });
        })
      );
    } else {
      this.router.navigate(['/login']);
      return of({ success: true, message: 'Logged out locally' });
    }
  }

  // Clear session data
  private clearSession(): void {
    this._isAuthenticated = false;
    this._role = null;
    this._userData = null;
    this.clearLocalStorage();
  }

  private clearLocalStorage(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('contractor');
    localStorage.removeItem('supplier');
    console.log('Local storage cleared');
  }

  // Restore session from localStorage
  restoreSession(): void {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('currentUser');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        this._isAuthenticated = true;
        this._role = user.role;
        this._userData = user;
        console.log('Session restored:', { 
          role: user.role, 
          userId: this.getCurrentUserId(),
          token: token ? 'Token present' : 'No token' 
        });
      } catch (error) {
        console.error('Error restoring session:', error);
        this.clearSession();
      }
    } else {
      console.log('No session to restore');
    }
  }

  // Validate token with backend
  validateToken(): Observable<any> {
    const token = this.token;
    if (!token) {
      console.log('No token found for validation');
      return of({ valid: false });
    }

    // FIXED: Correct API endpoint URL
    return this.http.get(`${this.apiUrl}/api/auth/validate-token`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).pipe(
      tap(response => {
        console.log('Token validation successful');
      }),
      catchError(error => {
        console.error('Token validation failed:', error);
        this.clearSession();
        throw error;
      })
    );
  }

  // Get current user ID based on role
  getCurrentUserId(): number | string | null {
    if (!this._userData) {
      console.log('No user data available');
      return null;
    }

    let userId = null;
    
    switch (this._role) {
      case 'CONTRACTOR':
        userId = this._userData.contractorId || this._userData.id;
        break;
      case 'SUPPLIER':
        userId = this._userData.supplierId || this._userData.id;
        break;
      case 'SUPER_ADMIN':
        userId = 'super_admin';
        break;
      case 'REGULATOR':
        userId = 'regulator';
        break;
      default:
        userId = null;
    }

    console.log('Getting current user ID:', { role: this._role, userId });
    return userId;
  }

  // Get current user ID as number (for APIs expecting numeric ID)
  getCurrentUserIdAsNumber(): number | null {
    const userId = this.getCurrentUserId();
    if (typeof userId === 'number') {
      return userId;
    }
    
    // Try to parse if it's a string
    if (typeof userId === 'string' && !isNaN(Number(userId))) {
      return Number(userId);
    }
    
    return null;
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    return this._role === role;
  }

  // Check if user is verified
  isVerified(): boolean {
    if (!this._userData) return false;

    switch (this._role) {
      case 'CONTRACTOR':
        return this._userData.isVerified === true;
      case 'SUPPLIER':
        return this._userData.verified === true;
      default:
        return true;
    }
  }

  // Get user's company name
  getCompanyName(): string {
    return this._userData?.companyName || '';
  }

  // Get user's contact person name
  getContactPerson(): string {
    return this._userData?.contactPerson || '';
  }

  getPerformanceMessage(): string {
    if (!this._userData) return ''; 
    return this._userData.performanceMessage || '';
  }

  // Debug method to check authentication state
  debugAuthState(): void {
    console.log('Auth Service Debug:', {
      isAuthenticated: this._isAuthenticated,
      role: this._role,
      token: this.token ? 'Present' : 'Missing',
      userId: this.getCurrentUserId(),
      userData: this._userData
    });
  }
}