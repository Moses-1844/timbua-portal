import { Component, OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SupplierService, QuotationRequest, Quote, Order, SubmitQuoteRequest } from './supplier.service';

@Component({
  selector: 'app-material-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './material-requests.component.html',
  styleUrls: ['./material-requests.component.scss']
})
export class MaterialRequestsComponent implements OnInit {
  // Data arrays
  quotationRequests: QuotationRequest[] = [];
  quotes: Quote[] = [];
  orders: Order[] = [];
  
  // Filtered arrays
  filteredRequests: QuotationRequest[] = [];
  filteredQuotes: Quote[] = [];
  filteredOrders: Order[] = [];
  
  // Modal data - initialized with defaults
  selectedRequest: QuotationRequest | null = null;
  selectedQuote: Quote | null = null;
  selectedOrder: Order | null = null;
  
  // New quote form
  newQuote: SubmitQuoteRequest = {
    totalAmount: 0,
    deliveryTime: '',
    terms: ''
  };
  
  // Filters
  requestFilter = {
    status: 'all',
    search: ''
  };
  
  quoteFilter = {
    status: 'all',
    search: ''
  };
  
  orderFilter = {
    status: 'all',
    search: ''
  };
  
  // Loading states
  isLoading = {
    requests: false,
    quotes: false,
    orders: false
  };
  
  // Error messages
  errorMessages = {
    requests: '',
    quotes: '',
    orders: '',
    submitQuote: ''
  };
  
  // Active tab
  activeTab: 'requests' | 'quotes' | 'orders' = 'requests';
  
  // Modal references
  private modalRef: NgbModalRef | null = null;
  
  constructor(
    private supplierService: SupplierService,
    private modalService: NgbModal
  ) {}
  
  ngOnInit() {
    this.loadSupplierData();
  }
  
  loadSupplierData() {
    const supplierId = this.supplierService.getSupplierId();
    
    if (!supplierId) {
      console.error('No supplier ID found');
      this.errorMessages.requests = 'Please log in as a supplier';
      return;
    }
    
    this.loadQuotationRequests(supplierId);
    this.loadQuotes(supplierId);
    this.loadOrders(supplierId);
  }
  
  loadQuotationRequests(supplierId: number) {
    this.isLoading.requests = true;
    this.errorMessages.requests = '';
    
    this.supplierService.getQuotationRequests(supplierId).subscribe({
      next: (requests) => {
        this.quotationRequests = requests;
        this.filteredRequests = [...requests];
        this.isLoading.requests = false;
      },
      error: (error) => {
        console.error('Error loading quotation requests:', error);
        this.errorMessages.requests = 'Failed to load quotation requests';
        this.isLoading.requests = false;
      }
    });
  }
  
  loadQuotes(supplierId: number) {
    this.isLoading.quotes = true;
    this.errorMessages.quotes = '';
    
    this.supplierService.getSupplierQuotes(supplierId).subscribe({
      next: (quotes) => {
        this.quotes = quotes;
        this.filteredQuotes = [...quotes];
        this.isLoading.quotes = false;
      },
      error: (error) => {
        console.error('Error loading quotes:', error);
        this.errorMessages.quotes = 'Failed to load quotes';
        this.isLoading.quotes = false;
      }
    });
  }
  
  loadOrders(supplierId: number) {
    this.isLoading.orders = true;
    this.errorMessages.orders = '';
    
    this.supplierService.getSupplierOrders(supplierId).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = [...orders];
        this.isLoading.orders = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.errorMessages.orders = 'Failed to load orders';
        this.isLoading.orders = false;
      }
    });
  }
  
  // Modal methods with null checks
  openRequestDetails(request: QuotationRequest, content: TemplateRef<any>) {
    this.selectedRequest = request;
    this.modalRef = this.modalService.open(content, { size: 'lg', centered: true });
  }
  
  openQuoteDetails(quote: Quote, content: TemplateRef<any>) {
    this.selectedQuote = quote;
    this.modalRef = this.modalService.open(content, { size: 'lg', centered: true });
  }
  
  openOrderDetails(order: Order, content: TemplateRef<any>) {
    this.selectedOrder = order;
    this.modalRef = this.modalService.open(content, { size: 'xl', centered: true });
  }
  
  openSubmitQuote(request: QuotationRequest, content: TemplateRef<any>) {
    this.selectedRequest = request;
    this.newQuote = {
      totalAmount: 0,
      deliveryTime: '',
      terms: ''
    };
    this.errorMessages.submitQuote = '';
    this.modalRef = this.modalService.open(content, { size: 'lg', centered: true });
  }
  
  closeModal() {
    if (this.modalRef) {
      this.modalRef.close();
      this.modalRef = null;
    }
    // Reset selected items
    this.selectedRequest = null;
    this.selectedQuote = null;
    this.selectedOrder = null;
  }
  
  // Submit quote
  submitQuote() {
    if (!this.selectedRequest) {
      this.errorMessages.submitQuote = 'No request selected';
      return;
    }
    
    const supplierId = this.supplierService.getSupplierId();
    if (!supplierId) {
      this.errorMessages.submitQuote = 'Supplier ID not found';
      return;
    }
    
    // Validation
    if (this.newQuote.totalAmount <= 0) {
      this.errorMessages.submitQuote = 'Total amount must be greater than 0';
      return;
    }
    
    if (!this.newQuote.deliveryTime) {
      this.errorMessages.submitQuote = 'Delivery time is required';
      return;
    }
    
    this.supplierService.submitQuote(this.selectedRequest.id, supplierId, this.newQuote).subscribe({
      next: (quote) => {
        // Add to quotes array
        this.quotes.push(quote);
        this.filteredQuotes.push(quote);
        
        // Update request status locally
        const requestIndex = this.quotationRequests.findIndex(r => r.id === this.selectedRequest!.id);
        if (requestIndex > -1) {
          this.quotationRequests[requestIndex].quotes.push(quote);
        }
        
        this.closeModal();
        alert('Quote submitted successfully!');
        
        // Reload data to get updated status
        this.loadQuotationRequests(supplierId);
      },
      error: (error) => {
        console.error('Error submitting quote:', error);
        this.errorMessages.submitQuote = error.error?.message || 'Failed to submit quote';
      }
    });
  }
  
  // Update order status
  updateOrderStatus(orderId: number, status: string) {
    this.supplierService.updateOrderStatus(orderId, status).subscribe({
      next: (updatedOrder) => {
        // Update local order
        const index = this.orders.findIndex(o => o.id === orderId);
        if (index > -1) {
          this.orders[index] = updatedOrder;
          this.filteredOrders[index] = updatedOrder;
        }
        
        if (this.selectedOrder?.id === orderId) {
          this.selectedOrder = updatedOrder;
        }
        
        alert(`Order status updated to ${status}`);
      },
      error: (error) => {
        console.error('Error updating order status:', error);
        alert('Failed to update order status');
      }
    });
  }
  
  // Filter methods
  filterRequests() {
    this.filteredRequests = this.quotationRequests.filter(request => {
      // Status filter
      if (this.requestFilter.status !== 'all' && request.status !== this.requestFilter.status) {
        return false;
      }
      
      // Search filter
      if (this.requestFilter.search) {
        const search = this.requestFilter.search.toLowerCase();
        return (
          request.material.toLowerCase().includes(search) ||
          (request.contractor?.companyName?.toLowerCase() || '').includes(search)
        );
      }
      
      return true;
    });
  }
  
  filterQuotes() {
    this.filteredQuotes = this.quotes.filter(quote => {
      // Status filter
      if (this.quoteFilter.status !== 'all' && quote.status !== this.quoteFilter.status) {
        return false;
      }
      
      // Search filter
      if (this.quoteFilter.search) {
        const search = this.quoteFilter.search.toLowerCase();
        return (
          (quote.terms?.toLowerCase() || '').includes(search) ||
          (quote.deliveryTime?.toLowerCase() || '').includes(search)
        );
      }
      
      return true;
    });
  }
  
  filterOrders() {
    this.filteredOrders = this.orders.filter(order => {
      // Status filter
      if (this.orderFilter.status !== 'all' && order.status !== this.orderFilter.status) {
        return false;
      }
      
      // Search filter
      if (this.orderFilter.search) {
        const search = this.orderFilter.search.toLowerCase();
        return (
          (order.orderReference?.toLowerCase() || '').includes(search) ||
          (order.siteName?.toLowerCase() || '').includes(search) ||
          (order.contractor?.companyName?.toLowerCase() || '').includes(search)
        );
      }
      
      return true;
    });
  }
  
  // Helper methods
  getStatusBadgeClass(status?: string): string {
    if (!status) return 'badge bg-secondary';
    
    switch (status) {
      case 'PENDING':
      case 'DRAFT':
        return 'badge bg-warning';
      case 'ACCEPTED':
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return 'badge bg-info';
      case 'DELIVERED':
      case 'FULLY_PAID':
        return 'badge bg-success';
      case 'REJECTED':
      case 'CANCELLED':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }
  
  getPaymentStatusBadgeClass(status?: string): string {
    if (!status) return 'badge bg-secondary';
    
    switch (status) {
      case 'PENDING_PAYMENT':
        return 'badge bg-warning';
      case 'PARTIALLY_PAID':
        return 'badge bg-info';
      case 'FULLY_PAID':
        return 'badge bg-success';
      default:
        return 'badge bg-secondary';
    }
  }
  
  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }
  
  formatCurrency(amount?: number, currency: string = 'KSH'): string {
    if (amount === undefined || amount === null) return `${currency} 0`;
    
    try {
      if (currency === 'KSH') {
        return `KSH ${amount.toLocaleString('en-KE')}`;
      } else if (currency === 'USD') {
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `${currency} ${amount.toLocaleString()}`;
    } catch (error) {
      return `${currency} ${amount}`;
    }
  }
  
  // Safe getters for template
  getSelectedRequestStatus(): string {
    return this.selectedRequest?.status || 'N/A';
  }
  
  getSelectedOrderStatus(): string {
    return this.selectedOrder?.status || 'N/A';
  }
  
  getSelectedOrderPaymentStatus(): string {
    return this.selectedOrder?.paymentStatus || 'N/A';
  }
  
  // Check if supplier can submit quote for request
  canSubmitQuote(request: QuotationRequest): boolean {
    return request.status === 'PENDING' && !this.hasSubmittedQuote(request);
  }
  
  // Check if supplier has already submitted a quote for a request
  hasSubmittedQuote(request: QuotationRequest): boolean {
    const supplierId = this.supplierService.getSupplierId();
    if (!supplierId) return false;
    
    // Check if any quote in this request belongs to current supplier
    // This logic depends on your API structure
    return false; // Placeholder
  }
  
  // Refresh all data
  refreshAll() {
    const supplierId = this.supplierService.getSupplierId();
    if (supplierId) {
      this.loadQuotationRequests(supplierId);
      this.loadQuotes(supplierId);
      this.loadOrders(supplierId);
    } else {
      this.errorMessages.requests = 'Please log in to refresh data';
    }
  }
  
  // Tab switching
  switchTab(tab: 'requests' | 'quotes' | 'orders') {
    this.activeTab = tab;
  }
  
  // Clear all filters
  clearFilters() {
    this.requestFilter = { status: 'all', search: '' };
    this.quoteFilter = { status: 'all', search: '' };
    this.orderFilter = { status: 'all', search: '' };
    
    this.filteredRequests = [...this.quotationRequests];
    this.filteredQuotes = [...this.quotes];
    this.filteredOrders = [...this.orders];
  }
}