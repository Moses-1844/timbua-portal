import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

// Updated interfaces to match API schema
interface ContractorRegistration {
  id?: number; // Add id as optional
  companyName: string;
  email: string;
  password: string;
  contactPerson: string;
  phoneNumber: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  specialization: string;
  yearsOfExperience: number;
  licenseNumber: string;
  status?: string;
  role?: string;
  isVerified?: boolean;
}

interface SupplierRegistration {
  id?: number; // Add id as optional
  companyName: string;
  businessRegistrationNumber: string;
  contactPerson: string;
  email: string;
  password: string;
  phone: string;
  website?: string;
  description?: string;
  yearsInBusiness: number;
  logoUrl?: string;
  status?: string;
  role?: string;
  verified?: boolean;
}

interface ApiResponse<T> {
  data?: T;
  messageCode?: string;
  message?: string;
}

interface Role {
  value: 'contractor' | 'supplier';
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-signup',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class Signup { // Changed from SignupComponent to Signup
  // Basic user info
  user = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: '' as 'contractor' | 'supplier',
    agreedToTerms: false
  };

  // Contractor specific fields
  contractor = {
    companyName: '',
    businessRegistrationNumber: '',
    physicalAddress: '',
    specialization: '',
    yearsOfExperience: 0,
    licenseNumber: ''
  };

  // Supplier specific fields
  supplier = {
    companyName: '',
    businessRegistrationNumber: '',
    website: '',
    description: '',
    yearsInBusiness: 0,
    logoUrl: ''
  };

  isLoading = false;
  passwordMismatch = false;
  emailAvailable: boolean | null = null;
  emailChecking = false;
  errorMessage = '';
  successMessage = '';

  private emailCheckSubject = new Subject<string>();

  roles: Role[] = [
    { 
      value: 'contractor', 
      label: 'Contractor', 
      description: 'Manage construction projects, create bids, and source materials',
      icon: 'bi bi-building-gear'
    },
    { 
      value: 'supplier', 
      label: 'Supplier', 
      description: 'Provide construction materials, manage inventory, and receive quotes',
      icon: 'bi bi-truck'
    }
  ];

  specializations = [
    'Residential Buildings',
    'Commercial Buildings',
    'Road Construction',
    'Bridge Construction',
    'Renovation & Remodeling',
    'Electrical Works',
    'Plumbing Works',
    'General Construction',
    'Civil Engineering',
    'Architectural Design'
  ];

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Setup email availability check with debounce
    this.emailCheckSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(email => {
      this.checkEmailAvailabilityApi(email);
    });
  }

  validatePassword(): boolean {
    this.passwordMismatch = this.user.password !== this.user.confirmPassword;
    return !this.passwordMismatch;
  }

  getPasswordStrength(): number {
    if (!this.user.password) return 0;
    
    let strength = 0;
    if (this.user.password.length >= 6) strength += 1;
    if (this.user.password.match(/[a-z]/)) strength += 1;
    if (this.user.password.match(/[A-Z]/)) strength += 1;
    if (this.user.password.match(/[0-9]/)) strength += 1;
    if (this.user.password.match(/[^a-zA-Z0-9]/)) strength += 1;
    
    return strength;
  }

  getPasswordStrengthClass(): string {
    const strength = this.getPasswordStrength();
    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    if (strength <= 2) return 'Weak password';
    if (strength <= 4) return 'Medium strength';
    return 'Strong password';
  }

  selectRole(role: 'contractor' | 'supplier') {
    this.user.role = role;
    this.clearMessages();
  }

  checkEmailAvailability() {
    if (this.user.email && this.user.email.includes('@')) {
      this.emailChecking = true;
      this.emailCheckSubject.next(this.user.email);
    }
  }

  private checkEmailAvailabilityApi(email: string) {
    this.http.get<any>(`${environment.apiUrl}/api/auth/check-email?email=${email}`)
      .subscribe({
        next: (response) => {
          this.emailChecking = false;
          // Adjust based on actual API response structure
          this.emailAvailable = response.available !== false;
        },
        error: (error) => {
          this.emailChecking = false;
          // If API fails, assume email is available (don't block signup)
          this.emailAvailable = true;
        }
      });
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  isFormValid(): boolean {
    // Basic validation
    if (!this.user.fullName || !this.user.email || !this.user.password || 
        !this.user.phone || !this.user.role || !this.user.agreedToTerms) {
      return false;
    }

    if (this.passwordMismatch) {
      return false;
    }

    if (this.emailAvailable === false) {
      return false;
    }

    // Role-specific validation
    if (this.user.role === 'contractor') {
      return !!(this.contractor.companyName && 
                this.contractor.businessRegistrationNumber && 
                this.contractor.physicalAddress && 
                this.contractor.specialization && 
                this.contractor.yearsOfExperience > 0 && 
                this.contractor.licenseNumber);
    }

    if (this.user.role === 'supplier') {
      return !!(this.supplier.companyName && 
                this.supplier.businessRegistrationNumber && 
                this.supplier.yearsInBusiness > 0);
    }

    return false;
  }

  onSubmit() {
    if (!this.validatePassword()) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (!this.isFormValid()) {
      this.errorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.isLoading = true;
    this.clearMessages();

    if (this.user.role === 'contractor') {
      this.registerContractor();
    } else if (this.user.role === 'supplier') {
      this.registerSupplier();
    }
  }

  private registerContractor() {
    const contractorData: ContractorRegistration = {
      companyName: this.contractor.companyName,
      email: this.user.email,
      password: this.user.password,
      contactPerson: this.user.fullName,
      phoneNumber: this.user.phone,
      businessRegistrationNumber: this.contractor.businessRegistrationNumber,
      physicalAddress: this.contractor.physicalAddress,
      specialization: this.contractor.specialization,
      yearsOfExperience: this.contractor.yearsOfExperience,
      licenseNumber: this.contractor.licenseNumber,
      status: 'PENDING',
      role: 'CONTRACTOR',
      isVerified: false
    };
    console.log('Payload sent:', contractorData);
    this.http.post<ContractorRegistration>(`${environment.apiUrl}/api/contractors/register`, contractorData)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = '🎉 Contractor account created successfully! Your account is pending verification. Redirecting to login...';
          console.log('Response received:', response);
          // Use optional chaining to safely access id
          if (response.id) {
            localStorage.setItem('pendingContractorId', response.id.toString());
          }
          
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        },
        error: (error) => {
          this.isLoading = false;
          this.handleSignupError(error, 'contractor');
        }
      });
  }

  private registerSupplier() {
    const supplierData: SupplierRegistration = {
      companyName: this.supplier.companyName,
      businessRegistrationNumber: this.supplier.businessRegistrationNumber,
      contactPerson: this.user.fullName,
      email: this.user.email,
      password: this.user.password,
      phone: this.user.phone,
      website: this.supplier.website || undefined,
      description: this.supplier.description || undefined,
      yearsInBusiness: this.supplier.yearsInBusiness,
      logoUrl: this.supplier.logoUrl || undefined,
      status: 'PENDING',
      role: 'SUPPLIER',
      verified: false
    };

    this.http.post<ApiResponse<any>>(`${environment.apiUrl}/api/suppliers/register`, supplierData)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = '🎉 Supplier account created successfully! Your account is pending verification. Redirecting to login...';
          
          // Use optional chaining to safely access nested id
          if (response.data?.id) {
            localStorage.setItem('pendingSupplierId', response.data.id.toString());
          }
          
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        },
        error: (error) => {
          this.isLoading = false;
          this.handleSignupError(error, 'supplier');
        }
      });
  }

  private handleSignupError(error: any, role: string) {
    console.error('Signup error:', error);
    
    let errorMsg = `Unable to create ${role} account. Please try again.`;
    
    if (error.status === 400) {
      if (error.error && error.error.message) {
        errorMsg = error.error.message;
      } else {
        errorMsg = 'Invalid information provided. Please check your details.';
      }
    } else if (error.status === 409) {
      errorMsg = 'This email is already registered. Please use a different email or sign in.';
    } else if (error.status === 0) {
      errorMsg = 'Network error. Please check your internet connection and try again.';
    } else if (error.status >= 500) {
      errorMsg = 'Our servers are busy. Please try again in a few moments.';
    } else if (error.error && error.error.message) {
      errorMsg = error.error.message;
    }
    
    this.errorMessage = errorMsg;
  }

  ngOnDestroy() {
    this.emailCheckSubject.complete();
  }
}