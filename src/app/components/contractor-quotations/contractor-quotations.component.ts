import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SmartQuotationService } from '../../services/smart-quotation.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-contractor-quotations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contractor-quotations.component.html',
  styleUrls: ['./contractor-quotations.component.scss']
})
export class ContractorQuotationsComponent implements OnInit {
  // Contractor info
  contractorId: number = 0;
  currentUser: any = null;
  
  // Workflow state
  loading = false;
  currentStep = 1;
  totalSteps = 4;
  
  // Step 1: Contractor sites
  contractorSites: any[] = [];
  selectedSite: any = null;
  
  // Step 2: Material suggestions
  suggestedMaterials: any[] = [];
  selectedMaterials: Array<{
    materialId: number;
    materialName: string;
    quantity: number;
    unit: string;
    adjustedQuantity: number;
    selected: boolean;
  }> = [];
  
  // Step 3: Nearby suppliers
  nearbySuppliers: any[] = [];
  selectedSuppliers: { [key: number]: boolean } = {};
  
  // Step 4: Results
  quotationResult: any = null;

  constructor(
    private quotationService: SmartQuotationService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadContractorId();
  }

  loadContractorId() {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated) {
      alert('You must be logged in to use this feature.');
      return;
    }

    // Check if user is a contractor
    if (!this.authService.hasRole('CONTRACTOR')) {
      alert('You must be logged in as a contractor to send quotation requests.');
      return;
    }

    // Check if contractor is verified
    if (!this.authService.isVerified()) {
      alert('Your contractor account needs to be verified before you can send quotation requests.');
      return;
    }

    // Get current user data
    this.currentUser = this.authService.userData;
    
    // Get contractor ID
    this.contractorId = this.authService.getCurrentUserIdAsNumber() || 0;
    
    if (this.contractorId === 0) {
      console.error('Could not retrieve contractor ID.');
      alert('Could not retrieve contractor information. Please try logging in again.');
      return;
    }

    console.log('Contractor verified and loaded:', {
      contractorId: this.contractorId,
      companyName: this.currentUser?.companyName
    });
  }

  // ========== STEP 1: LOAD CONTRACTOR SITES ==========
  async loadContractorSites() {
    if (this.contractorId === 0) {
      alert('Contractor ID not found');
      return;
    }

    this.loading = true;
    try {
      this.contractorSites = await this.quotationService.getContractorSites(this.contractorId).toPromise() || [];
      
      if (this.contractorSites.length === 0) {
        alert('No construction sites found for your account. Please create a site first.');
      } else {
        this.currentStep = 2; // Move to site selection step
      }
    } catch (error) {
      console.error('Error loading sites:', error);
      alert('Failed to load your construction sites');
    } finally {
      this.loading = false;
    }
  }

  selectSite(site: any) {
    this.selectedSite = site;
    console.log('Selected site:', site);
  }

  // ========== STEP 2: GET MATERIAL SUGGESTIONS ==========
  async getMaterialSuggestions() {
    if (!this.selectedSite) {
      alert('Please select a construction site first');
      return;
    }

    this.loading = true;
    try {
      // Get AI suggestions based on site type
      const suggestions = await this.quotationService.getAIMaterialSuggestions(this.selectedSite);
      this.suggestedMaterials = suggestions;
      
      // Initialize selection with default quantities
      this.selectedMaterials = suggestions.map(suggestion => ({
        materialId: suggestion.materialId || 0,
        materialName: suggestion.material,
        quantity: suggestion.estimatedQuantity,
        unit: suggestion.unit,
        adjustedQuantity: suggestion.estimatedQuantity,
        selected: false
      }));
      
      this.currentStep = 3; // Move to material selection step
      
    } catch (error) {
      console.error('Error getting material suggestions:', error);
      alert('Failed to generate material suggestions');
    } finally {
      this.loading = false;
    }
  }

  onMaterialSelectionChange(index: number, selected: boolean) {
    this.selectedMaterials[index].selected = selected;
  }

  updateMaterialQuantity(index: number, quantity: number) {
    if (quantity > 0) {
      this.selectedMaterials[index].adjustedQuantity = quantity;
    }
  }

  getSelectedMaterialsCount(): number {
    return this.selectedMaterials.filter(m => m.selected).length;
  }

  // ========== STEP 3: FIND NEARBY SUPPLIERS ==========
  async findNearbySuppliers() {
    const selectedCount = this.getSelectedMaterialsCount();
    if (selectedCount === 0) {
      alert('Please select at least one material');
      return;
    }

    this.loading = true;
    try {
      // Get all suppliers
      const allSuppliers = await this.quotationService.getSuppliers().toPromise() || [];
      
      // Filter suppliers within 100km radius
      this.nearbySuppliers = this.quotationService.getNearbySuppliers(this.selectedSite, allSuppliers);
      
      // Get materials data to match with suppliers
      const materials = await this.quotationService.getMaterials().toPromise() || [];
      
      // Filter suppliers who have the selected materials
      const selectedMaterialIds = this.selectedMaterials
        .filter(m => m.selected)
        .map(m => m.materialId);
      
      this.nearbySuppliers = this.nearbySuppliers.filter(supplier => {
        const supplierMaterials = supplier.materials || [];
        // Check if supplier has at least one of the selected materials
        return supplierMaterials.some((materialId: number) => 
          selectedMaterialIds.includes(materialId)
        );
      });

      // Initialize supplier selection (select all by default)
      this.selectedSuppliers = {};
      this.nearbySuppliers.forEach(supplier => {
        this.selectedSuppliers[supplier.id] = true;
      });

      if (this.nearbySuppliers.length === 0) {
        alert('No suppliers found within 100km radius that supply the selected materials.');
      } else {
        this.currentStep = 4; // Move to supplier selection step
      }
      
    } catch (error) {
      console.error('Error finding nearby suppliers:', error);
      alert('Failed to find nearby suppliers');
    } finally {
      this.loading = false;
    }
  }

  getSelectedSupplierIds(): number[] {
    return Object.keys(this.selectedSuppliers)
      .filter(id => this.selectedSuppliers[parseInt(id)])
      .map(id => parseInt(id));
  }

  // ========== STEP 4: SEND QUOTATION REQUESTS ==========
  async sendQuotationRequests() {
    const selectedSupplierIds = this.getSelectedSupplierIds();
    if (selectedSupplierIds.length === 0) {
      alert('Please select at least one supplier');
      return;
    }

    // Prepare selections for each material
    const selections = this.selectedMaterials
      .filter(m => m.selected)
      .map(material => ({
        siteId: this.selectedSite.id,
        materialId: material.materialId,
        materialName: material.materialName,
        quantity: material.adjustedQuantity,
        unit: material.unit,
        supplierIds: selectedSupplierIds
      }));

    if (selections.length === 0) {
      alert('No materials selected');
      return;
    }

    this.loading = true;
    try {
      this.quotationResult = await this.quotationService.sendBulkQuotationRequests(
        this.contractorId,
        selections
      );

      if (this.quotationResult.success) {
        console.log('Quotations sent successfully:', this.quotationResult);
        // Show success message
        alert(`${this.quotationResult.sentCount} quotation requests sent successfully!`);
      } else {
        alert('Failed to send some quotation requests: ' + this.quotationResult.error);
      }
    } catch (error) {
      console.error('Error sending quotations:', error);
      alert('Error sending quotation requests');
    } finally {
      this.loading = false;
    }
  }

  // ========== NAVIGATION & RESET ==========
  goToStep(step: number) {
    if (step < this.currentStep) {
      this.currentStep = step;
    }
  }

  resetWorkflow() {
    this.currentStep = 1;
    this.selectedSite = null;
    this.contractorSites = [];
    this.suggestedMaterials = [];
    this.selectedMaterials = [];
    this.nearbySuppliers = [];
    this.selectedSuppliers = {};
    this.quotationResult = null;
  }

  // ========== GETTERS FOR TEMPLATE ==========
  getContractorInfo(): any {
    if (this.currentUser) {
      return {
        companyName: this.currentUser.companyName || 'Unknown Company',
        contactPerson: this.currentUser.contactPerson || 'Unknown',
        email: this.currentUser.email || ''
      };
    }
    return null;
  }

  isMaterialSelected(materialId: number): boolean {
    const material = this.selectedMaterials.find(m => m.materialId === materialId);
    return material ? material.selected : false;
  }
}