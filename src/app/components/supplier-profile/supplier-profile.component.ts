// src/app/components/supplier-profile/supplier-profile.component.ts
 
import { SupplierService, Supplier } from '../../services/supplier.service';
// src/app/components/supplier-profile/supplier-profile.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
 

@Component({
  selector: 'app-supplier-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-profile.component.html',
  styleUrls: ['./supplier-profile.component.scss']
})
export class SupplierProfileComponent  implements OnInit {
  supplier: Supplier | null = null;
  editMode = false;
  isLoading = true;
  error = '';
  success = '';

  editedSupplier: Partial<Supplier> = {};

  constructor(
    private supplierService: SupplierService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('Supplier Profile Component Initialized');
    this.loadSupplierProfile();
  }

  loadSupplierProfile(): void {
    this.isLoading = true;
    this.error = '';

    // Debug storage first
    //this.supplierService.debugStorage();

    // Check authentication
    if (!this.supplierService.isAuthenticated()) {
      this.error = 'You are not authenticated. Please log in again.';
      this.isLoading = false;
      this.redirectToLogin();
      return;
    }

    try {
      const supplierId = this.supplierService.getSupplierId();
      
      if (!supplierId) {
        this.error = 'Unable to retrieve supplier information. Please log in again.';
        this.isLoading = false;
        this.redirectToLogin();
        return;
      }

      console.log('Loading supplier with ID:', supplierId);

      this.supplierService.getCurrentSupplier().subscribe({
        next: (response) => {
          console.log('Supplier data loaded successfully:', response);
          this.supplier = response.data;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading supplier:', error);
          
          if (error.message.includes('Access denied') || error.status === 403) {
            this.error = `
              Access denied (403). This could be because:
              - Your session has expired
              - You don't have permission to access this supplier data
              - The authentication token is missing or invalid
              Please try logging in again.
            `;
            this.redirectToLogin();
          } else if (error.message.includes('log in')) {
            this.error = 'Please log in again to access your profile.';
            this.redirectToLogin();
          } else {
            this.error = error.message || 'Failed to load supplier profile';
          }
          
          this.isLoading = false;
        }
      });
    } catch (error) {
      this.error = 'Unable to retrieve supplier information';
      this.isLoading = false;
      console.error('Unexpected error:', error);
    }
  }

  redirectToLogin(): void {
    setTimeout(() => {
      console.log('Redirecting to login page');
      this.router.navigate(['/login']);
    }, 3000);
  }

  retryLoad(): void {
    console.log('Retrying to load supplier profile');
    this.loadSupplierProfile();
  }

  // ... rest of your methods remain the same
  enterEditMode(): void {
    if (this.supplier) {
      this.editedSupplier = { ...this.supplier };
      this.editMode = true;
    }
  }

  cancelEdit(): void {
    this.editMode = false;
    this.editedSupplier = {};
    this.error = '';
    this.success = '';
  }

  saveProfile(): void {
    if (!this.supplier || !this.editedSupplier) return;

    this.isLoading = true;
    this.error = '';
    this.success = '';

    this.supplierService.updateSupplier(this.supplier.id, this.editedSupplier as Supplier)
      .subscribe({
        next: (response) => {
          this.supplier = response.data;
          this.editMode = false;
          this.isLoading = false;
          this.success = 'Profile updated successfully';
        },
        error: (error) => {
          this.error = error.message || 'Failed to update profile';
          this.isLoading = false;
        }
      });
  }

  getVerificationStatus(): string {
    if (!this.supplier) return 'Unknown';
    
    if (this.supplier.verified) {
      return 'Verified';
    } else if (this.supplier.status === 'PENDING') {
      return 'Pending Verification';
    } else {
      return this.supplier.status;
    }
  }

  getVerificationBadgeClass(): string {
    if (!this.supplier) return 'badge-secondary';
    
    if (this.supplier.verified) {
      return 'badge-success';
    } else if (this.supplier.status === 'PENDING') {
      return 'badge-warning';
    } else {
      return 'badge-danger';
    }
  }
}