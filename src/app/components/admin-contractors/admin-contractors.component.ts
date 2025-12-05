import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractorService } from './contractor.service';
import { Contractor, Document, Site } from './contractor.types';
import { FileSizePipe } from './file-size.pipe';
import * as jspdf from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-admin-contractors',
  standalone: true,
  imports: [CommonModule, FormsModule, FileSizePipe],
  templateUrl: './admin-contractors.component.html',
  styleUrls: ['./admin-contractors.component.scss']
})
export class AdminContractorsComponent implements OnInit {
  contractors: Contractor[] = [];
  sites: Site[] = [];
  selectedContractor: Contractor | null = null;
  contractorDocuments: Document[] = [];
  contractorSites: Site[] = [];
  
  // Modal states
  showContractorModal = false;
  showSiteModal = false;
  showDocumentsModal = false;
  showEditSiteModal = false;
  
  // Form models
  newContractor: Partial<Contractor> = {};
  newSite: Partial<Site> = {};
  editingSite: Site | null = null;
  editMode = false;
  
  // Filter
  searchTerm = '';
  statusFilter = 'ALL';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  constructor(private contractorService: ContractorService) {}

  ngOnInit(): void {
    this.loadContractors();
    this.loadAllSites();
  }

  loadContractors(): void {
    this.contractorService.getAllContractors().subscribe({
      next: (data) => {
        this.contractors = data;
      },
      error: (error) => {
        console.error('Error loading contractors:', error);
      }
    });
  }

  loadAllSites(): void {
    this.contractorService.getAllSites().subscribe({
      next: (data) => {
        this.sites = data;
      },
      error: (error) => {
        console.error('Error loading sites:', error);
      }
    });
  }

  getSitesForContractor(contractorId: number): Site[] {
    return this.sites.filter(site => site.contractor?.id === contractorId);
  }

  openContractorModal(contractor?: Contractor): void {
    if (contractor) {
      this.selectedContractor = { ...contractor };
      this.editMode = true;
    } else {
      this.selectedContractor = null;
      this.editMode = false;
      this.newContractor = {
        status: 'PENDING',
        role: 'CONTRACTOR',
        isVerified: false,
        registrationDate: new Date().toISOString()
      };
    }
    this.showContractorModal = true;
  }

  closeContractorModal(): void {
    this.showContractorModal = false;
    this.selectedContractor = null;
    this.newContractor = {};
  }

  saveContractor(): void {
    if (this.editMode && this.selectedContractor) {
      this.contractorService.updateContractor(this.selectedContractor.id, this.selectedContractor).subscribe({
        next: () => {
          this.loadContractors();
          this.closeContractorModal();
        }
      });
    } else {
      // For new contractor, use register endpoint
      const contractorToRegister = {
        companyName: this.newContractor.companyName || '',
        email: this.newContractor.email || '',
        password: 'TempPassword123!', // Default password, should be changed by user
        contactPerson: this.newContractor.contactPerson || '',
        phoneNumber: this.newContractor.phoneNumber || '',
        businessRegistrationNumber: this.newContractor.businessRegistrationNumber || '',
        physicalAddress: this.newContractor.physicalAddress || '',
        specialization: this.newContractor.specialization || '',
        yearsOfExperience: this.newContractor.yearsOfExperience || 0,
        licenseNumber: this.newContractor.licenseNumber || '',
        status: 'PENDING' as const,
        role: 'CONTRACTOR' as const,
        isVerified: false
      };
      
      this.contractorService.registerContractor(contractorToRegister).subscribe({
        next: () => {
          this.loadContractors();
          this.closeContractorModal();
        },
        error: (error) => {
          console.error('Error registering contractor:', error);
        }
      });
    }
  }

  verifyContractor(contractorId: number, approved: boolean): void {
    this.contractorService.verifyContractor(contractorId, approved).subscribe({
      next: () => {
        this.loadContractors();
      }
    });
  }

  deleteContractor(contractorId: number): void {
    if (confirm('Are you sure you want to delete this contractor?')) {
      this.contractorService.deleteContractor(contractorId).subscribe({
        next: () => {
          this.loadContractors();
        }
      });
    }
  }

  openSiteModal(contractor?: Contractor): void {
    if (contractor) {
      this.newSite.contractor = contractor;
    }
    this.showSiteModal = true;
  }

  closeSiteModal(): void {
    this.showSiteModal = false;
    this.newSite = {};
  }

  editSite(site: Site): void {
    this.editingSite = { ...site };
    this.showEditSiteModal = true;
  }

  closeEditSiteModal(): void {
    this.showEditSiteModal = false;
    this.editingSite = null;
  }

  saveSite(): void {
    if (this.editingSite) {
      // Update existing site
      this.contractorService.updateSite(this.editingSite.id, this.editingSite).subscribe({
        next: () => {
          this.loadAllSites();
          this.closeEditSiteModal();
        }
      });
    } else {
      // Create new site
      this.contractorService.createSite(this.newSite as Site).subscribe({
        next: () => {
          this.loadAllSites();
          this.closeSiteModal();
        }
      });
    }
  }

  deleteSite(siteId: number): void {
    if (confirm('Are you sure you want to delete this site?')) {
      this.contractorService.deleteSite(siteId).subscribe({
        next: () => {
          this.loadAllSites();
        }
      });
    }
  }

  viewDocuments(contractor: Contractor): void {
    this.selectedContractor = contractor;
    this.contractorService.getContractorDocuments(contractor.id).subscribe({
      next: (documents) => {
        this.contractorDocuments = documents;
        this.showDocumentsModal = true;
      }
    });
  }

  updateDocumentStatus(documentId: number, status: string): void {
    this.contractorService.updateDocumentStatus(documentId, status).subscribe({
      next: () => {
        // Refresh documents
        if (this.selectedContractor) {
          this.viewDocuments(this.selectedContractor);
        }
      }
    });
  }

  // Filtering
  get filteredContractors(): Contractor[] {
    let filtered = this.contractors;
    
    if (this.searchTerm) {
      filtered = filtered.filter(contractor =>
        contractor.companyName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        contractor.contactPerson.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        contractor.email.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    
    if (this.statusFilter !== 'ALL') {
      filtered = filtered.filter(contractor => contractor.status === this.statusFilter);
    }
    
    return filtered;
  }

  // Pagination
  get paginatedContractors(): Contractor[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredContractors.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredContractors.length / this.itemsPerPage);
  }

  // Export functionality
  exportToCSV(): void {
    const data = this.filteredContractors.map(contractor => ({
      'Company Name': contractor.companyName,
      'Contact Person': contractor.contactPerson,
      'Email': contractor.email,
      'Phone': contractor.phoneNumber,
      'Specialization': contractor.specialization,
      'Status': contractor.status,
      'Registration Date': new Date(contractor.registrationDate).toLocaleDateString(),
      'Verified': contractor.isVerified ? 'Yes' : 'No'
    }));

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contractors_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportToPDF(): void {
    const doc = new jspdf.jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Contractors Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Table
    const tableData = this.filteredContractors.map(contractor => [
      contractor.companyName,
      contractor.contactPerson,
      contractor.email,
      contractor.phoneNumber,
      contractor.status,
      contractor.isVerified ? 'Yes' : 'No'
    ]);
    
    autoTable(doc, {
      head: [['Company', 'Contact', 'Email', 'Phone', 'Status', 'Verified']],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`contractors_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  getStatusClass(status: string): string {
    switch(status) {
      case 'VERIFIED': return 'status-verified';
      case 'PENDING': return 'status-pending';
      case 'REJECTED': return 'status-rejected';
      case 'SUSPENDED': return 'status-suspended';
      default: return '';
    }
  }
}