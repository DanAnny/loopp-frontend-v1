// frontend/src/services/invoice.service.js
import { apiClient } from './http';

const invoices = {
  createInvoice: (payload) => apiClient.post("/integrations/billing/invoices", payload),
};

export default invoices;
