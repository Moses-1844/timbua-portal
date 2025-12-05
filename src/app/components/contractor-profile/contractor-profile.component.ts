import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface ContractorDocument {
  id: number;
  documentType: string;
  documentName: string;
  documentUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
}

interface ConstructionSite {
  id: number;
  name: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: string;
  estimatedCost: number;
  status: string;
  startDate: string;
  endDate: string;
  progress: number;
  documents: string[];
  contractorId: number;
}

interface QuotationRequest {
  id: number;
  materialId: number;
  supplierId: number;
  siteId: number;
  material: string;
  quantity: number;
  unit: string;
  deadline: string;
  status: string;
  quotes: any[];
  contractorId: number;
}

interface Contractor {
  id: number;
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
  status: string;
  role: string;
  isVerified: boolean;
  registrationDate: string;
  verificationDate: string;
  documents: ContractorDocument[];
  constructionSites: ConstructionSite[];
  quotationRequests: QuotationRequest[];
}

@Component({
  selector: 'app-contractor-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contractor-profile.component.html',
  styleUrls: ['./contractor-profile.component.scss']
})
export class ContractorProfileComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  contractor: Contractor | null = null;
  isLoading = true;
  isEditing = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  // Specialization options
  specializations = [
    'Residential Construction',
    'Commercial Construction',
    'Road Construction',
    'Bridge Construction',
    'Renovation',
    'Electrical Works',
    'Plumbing Works',
    'Masonry Works',
    'Carpentry Works',
    'Roofing Works',
    'Landscaping',
    'Excavation',
    'Concrete Works',
    'Steel Works',
    'Other'
  ];

  ngOnInit() {
    console.log('🔄 ContractorProfileComponent initialized');
    this.loadContractorProfile();
  }

  loadContractorProfile(): void {
    console.log('🔄 Starting to load contractor profile...');
    
    // Check authentication first
    if (!this.authService.isAuthenticated) {
      this.errorMessage = 'Please log in to view your profile';
      this.isLoading = false;
      console.error('❌ User not authenticated');
      return;
    }

    // Check if user is a contractor
    if (!this.authService.hasRole('CONTRACTOR')) {
      this.errorMessage = 'Access denied. This profile is only available for contractors.';
      this.isLoading = false;
      console.error('❌ User is not a contractor. Role:', this.authService.role);
      return;
    }

    // Get contractor ID with debugging
    const contractorId = this.authService.getCurrentUserId();
    console.log('🔍 Contractor ID from AuthService:', contractorId);
    console.log('🔍 User data from AuthService:', this.authService.userData);

    if (!contractorId) {
      this.errorMessage = 'Could not retrieve contractor information. Please try logging in again.';
      this.isLoading = false;
      console.error('❌ No contractor ID found');
      return;
    }

    // Try multiple ways to get the contractor data
    this.tryLoadContractorData(contractorId);
  }

  private tryLoadContractorData(contractorId: any): void {
    console.log('🔧 Attempting to load contractor data...');
    
    // First, try to get from localStorage (fastest)
    const localContractor = this.getContractorFromLocalStorage();
    if (localContractor) {
      console.log('✅ Loaded contractor from localStorage');
      this.contractor = localContractor;
      this.isLoading = false;
      return;
    }

    // If not in localStorage, try API call
    console.log('🌐 Making API call to fetch contractor data...');
    
    // Convert contractorId to number if it's a string
    const id = typeof contractorId === 'string' ? parseInt(contractorId, 10) : contractorId;
    
    if (isNaN(id)) {
      this.errorMessage = 'Invalid contractor ID format';
      this.isLoading = false;
      console.error('❌ Invalid contractor ID:', contractorId);
      return;
    }

    this.http.get<Contractor>(`https://timbuabackend.onrender.com/api/contractors/${id}`)
      .subscribe({
        next: (contractor) => {
          console.log('✅ Successfully loaded contractor from API:', contractor);
          this.contractor = contractor;
          this.isLoading = false;
          
          // Save to localStorage for future use
          this.saveContractorToLocalStorage(contractor);
        },
        error: (error) => {
          console.error('❌ API Error loading contractor profile:', error);
          
          // Try alternative approach - use userData from AuthService
          this.tryCreateFromUserData();
        }
      });
  }

  private getContractorFromLocalStorage(): Contractor | null {
    try {
      const contractorStr = localStorage.getItem('contractor');
      if (contractorStr) {
        return JSON.parse(contractorStr);
      }
    } catch (error) {
      console.error('Error reading contractor from localStorage:', error);
    }
    return null;
  }

  private saveContractorToLocalStorage(contractor: Contractor): void {
    try {
      localStorage.setItem('contractor', JSON.stringify(contractor));
    } catch (error) {
      console.error('Error saving contractor to localStorage:', error);
    }
  }

  private tryCreateFromUserData(): void {
    console.log('🔄 Trying to create contractor profile from user data...');
    
    const userData = this.authService.userData;
    if (userData && userData.role === 'CONTRACTOR') {
      // Create a basic contractor object from available user data
      this.contractor = {
        id: userData.id || userData.contractorId || 0,
        companyName: userData.companyName || 'Unknown Company',
        email: userData.email || '',
        password: '',
        contactPerson: userData.contactPerson || 'Unknown',
        phoneNumber: '',
        businessRegistrationNumber: '',
        physicalAddress: '',
        specialization: '',
        yearsOfExperience: 0,
        licenseNumber: '',
        status: userData.status || 'PENDING',
        role: 'CONTRACTOR',
        isVerified: userData.isVerified || false,
        registrationDate: new Date().toISOString(),
        verificationDate: '',
        documents: [],
        constructionSites: [],
        quotationRequests: []
      };
      this.isLoading = false;
      this.errorMessage = 'Profile loaded with limited information. Some details may be unavailable.';
      console.log('⚠️ Loaded basic contractor profile from user data');
    } else {
      this.errorMessage = 'Failed to load contractor profile. Please try refreshing the page or contact support.';
      this.isLoading = false;
      console.error('❌ Could not create contractor profile from user data');
    }
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.errorMessage = '';
    this.successMessage = '';
  }

  saveProfile(): void {
    if (!this.contractor) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Create update data without password if it's empty or unchanged
    const updateData = { ...this.contractor };
    
    // Remove password from update if it's empty (not changed)
    if (!updateData.password || updateData.password === '') {
      const { password, ...dataWithoutPassword } = updateData;
      this.performUpdate(dataWithoutPassword);
    } else {
      this.performUpdate(updateData);
    }
  }

  private performUpdate(updateData: any): void {
    console.log('🔄 Updating contractor profile...', updateData);

    this.http.put<Contractor>(
      `https://timbuabackend.onrender.com/api/contractors/${this.contractor!.id}`,
      updateData
    ).subscribe({
      next: (updatedContractor) => {
        console.log('✅ Profile updated successfully:', updatedContractor);
        this.contractor = updatedContractor;
        this.isEditing = false;
        this.isSubmitting = false;
        this.successMessage = 'Profile updated successfully!';
        
        // Update local storage with new data
        this.updateLocalStorage(updatedContractor);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('❌ Error updating contractor profile:', error);
        this.errorMessage = 'Failed to update profile. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  private updateLocalStorage(updatedContractor: Contractor): void {
    try {
      // Update contractor data in localStorage
      localStorage.setItem('contractor', JSON.stringify(updatedContractor));
      
      // Update current user data in localStorage
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        const updatedUserData = {
          ...userData,
          companyName: updatedContractor.companyName,
          contactPerson: updatedContractor.contactPerson,
          isVerified: updatedContractor.isVerified,
          status: updatedContractor.status
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUserData));
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.errorMessage = '';
    this.successMessage = '';
    // Reload original data
    this.loadContractorProfile();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'status-badge status-approved';
      case 'PENDING':
        return 'status-badge status-pending';
      case 'REJECTED':
        return 'status-badge status-rejected';
      case 'SUSPENDED':
        return 'status-badge status-suspended';
      default:
        return 'status-badge status-pending';
    }
  }

  getVerificationBadgeClass(isVerified: boolean): string {
    return isVerified ? 'verification-badge verified' : 'verification-badge not-verified';
  }

  getDocumentStatusBadgeClass(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'doc-status approved';
      case 'PENDING':
        return 'doc-status pending';
      case 'REJECTED':
        return 'doc-status rejected';
      default:
        return 'doc-status pending';
    }
  }

  getSiteStatusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'site-status completed';
      case 'IN_PROGRESS':
        return 'site-status in-progress';
      case 'PLANNING':
        return 'site-status planning';
      case 'ON_HOLD':
        return 'site-status on-hold';
      default:
        return 'site-status planning';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  downloadDocument(document: ContractorDocument): void {
    if (document.documentUrl) {
      window.open(document.documentUrl, '_blank');
    } else {
      this.errorMessage = 'Document URL not available';
    }
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return 'progress-high';
    if (progress >= 50) return 'progress-medium';
    return 'progress-low';
  }

  // Force reload the profile
  reloadProfile(): void {
    this.isLoading = true;
    this.errorMessage = '';
    // Clear localStorage to force fresh API call
    localStorage.removeItem('contractor');
    this.loadContractorProfile();
  }
}