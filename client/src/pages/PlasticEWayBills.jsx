import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  Card,
  DataTable,
  Modal,
  Button,
} from "../components";
import "./PlasticEWayBills.css";

function formatCurrency(val) {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-IN");
  } catch {
    return dateStr;
  }
}

function PlasticEWayBills() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [ewayBills, setEwayBills] = useState([]);
  const [kpis, setKpis] = useState({
    total: 0,
    draft: 0,
    ready: 0,
    dispatched: 0,
    completed: 0,
    cancelled: 0,
    totalValue: 0,
    totalWeight: 0,
  });

  // Reference lookups for auto-fill selection
  const [invoices, setInvoices] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");

  // Form Mode & Data
  const [sourceType, setSourceType] = useState("INVOICE"); // 'INVOICE', 'DISPATCH', 'MANUAL'
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [formData, setFormData] = useState({
    invoice_id: null,
    invoice_no: "",
    invoice_date: "",
    dispatch_id: null,
    dispatch_no: "",
    customer_id: null,
    customer_name: "",
    customer_gstin: "",
    customer_phone: "",
    customer_email: "",
    billing_address: "",
    shipping_address: "",
    dispatch_from_name: "SmartBilling Recycled Polymers Plant",
    dispatch_from_gstin: "",
    dispatch_from_address: "",
    transport_mode: "ROAD",
    distance_km: 50,
    transporter_name: "",
    transporter_id: "",
    vehicle_id: null,
    vehicle_number: "",
    vehicle_type: "REGULAR",
    driver_name: "",
    driver_mobile: "",
    dispatch_date: new Date().toISOString().split("T")[0],
    status: "DRAFT",
    notes: "",
    items: [],
  });

  // Item row for form
  const [newItem, setNewItem] = useState({
    product_name: "",
    hsn_code: "3915",
    quantity: 100,
    unit: "KG",
    rate: 50,
    tax_percent: 18,
    weight_kg: 100,
  });

  // Fetch E-Way Bills & KPIs
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, kpiRes, custRes, vehRes, invRes, dispRes] = await Promise.all([
        API.get("/plastic-erp/eway-bills").catch(() => ({ data: {} })),
        API.get("/plastic-erp/eway-bills/kpi").catch(() => ({ data: {} })),
        API.get("/customers").catch(() => ({ data: {} })),
        API.get("/plastic-erp/transport/vehicles").catch(() => ({ data: {} })),
        API.get("/invoices").catch(() => ({ data: {} })),
        API.get("/plastic-erp/dispatches").catch(() => ({ data: {} })),
      ]);

      if (listRes.data?.success) setEwayBills(listRes.data.ewayBills || []);
      if (kpiRes.data?.success) setKpis(kpiRes.data.kpis || {});
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (vehRes.data?.vehicles) setVehicles(vehRes.data.vehicles || []);
      if (invRes.data?.invoices) setInvoices(invRes.data.invoices || []);
      if (dispRes.data?.dispatches) setDispatches(dispRes.data.dispatches || []);
    } catch (err) {
      console.error("Failed to load E-Way Bill data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle URL query parameters (?invoice_id=... or ?dispatch_id=...)
  useEffect(() => {
    const invId = searchParams.get("invoice_id");
    const dispId = searchParams.get("dispatch_id");

    if (invId) {
      setSourceType("INVOICE");
      setSelectedSourceId(invId);
      loadSourceData("INVOICE", invId);
      setCreateModalOpen(true);
    } else if (dispId) {
      setSourceType("DISPATCH");
      setSelectedSourceId(dispId);
      loadSourceData("DISPATCH", dispId);
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  // Load Auto-fill source data
  const loadSourceData = async (type, id) => {
    if (!id) return;
    try {
      setSubmitting(true);
      const param = type === "INVOICE" ? `invoice_id=${id}` : `dispatch_id=${id}`;
      const res = await API.get(`/plastic-erp/eway-bills/source-data?${param}`);
      if (res.data?.success && res.data.sourceData) {
        const s = res.data.sourceData;
        setFormData((prev) => ({
          ...prev,
          invoice_id: s.invoice_id || null,
          invoice_no: s.invoice_no || "",
          invoice_date: s.invoice_date || "",
          dispatch_id: s.dispatch_id || null,
          dispatch_no: s.dispatch_no || "",
          customer_id: s.customer_id || null,
          customer_name: s.customer_name || "",
          customer_phone: s.customer_phone || "",
          customer_email: s.customer_email || "",
          billing_address: s.billing_address || "",
          shipping_address: s.shipping_address || "",
          dispatch_from_name: s.dispatch_from_name || prev.dispatch_from_name,
          dispatch_from_gstin: s.dispatch_from_gstin || "",
          dispatch_from_address: s.dispatch_from_address || "",
          transporter_name: s.transporter_name || "",
          vehicle_id: s.vehicle_id || null,
          vehicle_number: s.vehicle_number || "",
          driver_name: s.driver_name || "",
          driver_mobile: s.driver_mobile || "",
          items: s.items || [],
        }));
      }
    } catch (err) {
      console.error("Failed to load source data:", err);
      alert("Failed to auto-fill data from selected record");
    } finally {
      setSubmitting(false);
    }
  };

  // Add Item to form
  const handleAddItem = () => {
    if (!newItem.product_name || !String(newItem.product_name).trim()) {
      alert("Please enter a product description / name");
      return;
    }
    const qty = Number(newItem.quantity) || 0;
    const rate = Number(newItem.rate) || 0;
    const taxable = qty * rate;
    const taxPct = Number(newItem.tax_percent) || 18;
    const taxAmt = (taxable * taxPct) / 100;
    const total = taxable + taxAmt;
    const weight = Number(newItem.weight_kg) || qty;

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_name: newItem.product_name.trim(),
          hsn_code: newItem.hsn_code.trim() || "3915",
          quantity: qty,
          unit: newItem.unit,
          rate,
          taxable_amount: taxable,
          tax_percent: taxPct,
          tax_amount: taxAmt,
          total_amount: total,
          weight_kg: weight,
        },
      ],
    }));

    setNewItem({
      product_name: "",
      hsn_code: "3915",
      quantity: 100,
      unit: "KG",
      rate: 50,
      tax_percent: 18,
      weight_kg: 100,
    });
  };

  const handleRemoveItem = (idx) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  // Submit Create / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name || !String(formData.customer_name).trim()) {
      alert("Please enter recipient customer name");
      return;
    }
    if (!formData.vehicle_number || !String(formData.vehicle_number).trim()) {
      alert("Please enter transport vehicle number (e.g. GJ-05-BT-1234)");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      setSubmitting(true);
      if (formData.id) {
        // Update
        const res = await API.put(`/plastic-erp/eway-bills/${formData.id}`, formData);
        if (res.data?.success) {
          alert("Internal E-Way Bill updated successfully!");
          setCreateModalOpen(false);
          fetchData();
        }
      } else {
        // Create
        const res = await API.post("/plastic-erp/eway-bills", formData);
        if (res.data?.success) {
          alert(res.data.message || "Internal E-Way Bill created successfully!");
          setCreateModalOpen(false);
          fetchData();
        }
      }
    } catch (err) {
      console.error("Save E-Way Bill Error:", err);
      alert(err.response?.data?.message || "Failed to save Internal E-Way Bill");
    } finally {
      setSubmitting(false);
    }
  };

  // View Document in Modal
  const handleViewDocument = async (id) => {
    try {
      setLoading(true);
      const res = await API.get(`/plastic-erp/eway-bills/${id}`);
      if (res.data?.success && res.data.ewayBill) {
        setSelectedBill(res.data.ewayBill);
        setDocModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch E-Way Bill Detail Error:", err);
      alert("Failed to load E-Way Bill document details");
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const handleEditBill = async (bill) => {
    try {
      const res = await API.get(`/plastic-erp/eway-bills/${bill.id}`);
      if (res.data?.success && res.data.ewayBill) {
        const b = res.data.ewayBill;
        setFormData({
          id: b.id,
          invoice_id: b.invoice_id,
          invoice_no: b.invoice_no || "",
          invoice_date: b.invoice_date ? new Date(b.invoice_date).toISOString().split("T")[0] : "",
          dispatch_id: b.dispatch_id,
          dispatch_no: b.dispatch_no || "",
          customer_id: b.customer_id,
          customer_name: b.customer_name || "",
          customer_gstin: b.customer_gstin || "",
          customer_phone: b.customer_phone || "",
          customer_email: b.customer_email || "",
          billing_address: b.billing_address || "",
          shipping_address: b.shipping_address || "",
          dispatch_from_name: b.dispatch_from_name || "",
          dispatch_from_gstin: b.dispatch_from_gstin || "",
          dispatch_from_address: b.dispatch_from_address || "",
          transport_mode: b.transport_mode || "ROAD",
          distance_km: b.distance_km || 0,
          transporter_name: b.transporter_name || "",
          transporter_id: b.transporter_id || "",
          vehicle_id: b.vehicle_id,
          vehicle_number: b.vehicle_number || "",
          vehicle_type: b.vehicle_type || "REGULAR",
          driver_name: b.driver_name || "",
          driver_mobile: b.driver_mobile || "",
          dispatch_date: b.dispatch_date ? new Date(b.dispatch_date).toISOString().split("T")[0] : "",
          status: b.status || "DRAFT",
          notes: b.notes || "",
          items: b.items || [],
        });
        setCreateModalOpen(true);
      }
    } catch (err) {
      console.error("Load Bill For Edit Error:", err);
      alert("Failed to load record for editing");
    }
  };

  // Status Change
  const handleOpenStatusModal = (bill) => {
    setSelectedBill(bill);
    setTargetStatus("");
    setStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedBill || !targetStatus) return;
    try {
      setSubmitting(true);
      const res = await API.patch(`/plastic-erp/eway-bills/${selectedBill.id}/status`, {
        status: targetStatus,
      });
      if (res.data?.success) {
        alert(`E-Way Bill status updated to ${targetStatus}`);
        setStatusModalOpen(false);
        fetchData();
        if (selectedBill && docModalOpen) {
          setSelectedBill((prev) => ({ ...prev, status: targetStatus }));
        }
      }
    } catch (err) {
      console.error("Status Update Error:", err);
      alert(err.response?.data?.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Draft Bill
  const handleDeleteBill = async (id, ewbNo) => {
    if (!window.confirm(`Are you sure you want to permanently delete draft ${ewbNo}?`)) return;
    try {
      setSubmitting(true);
      const res = await API.delete(`/plastic-erp/eway-bills/${id}`);
      if (res.data?.success) {
        alert("Draft E-Way Bill deleted successfully");
        fetchData();
      }
    } catch (err) {
      console.error("Delete Bill Error:", err);
      alert(err.response?.data?.message || "Failed to delete E-Way Bill");
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Vector PDF using jsPDF
  const handleDownloadPDF = (bill = selectedBill) => {
    if (!bill) return;

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 14;

      // Internal Banner
      pdf.setFillColor(239, 68, 68);
      pdf.rect(margin, y, contentWidth, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        "INTERNAL TRANSPORT / E-WAY BILL PREPARATION DOCUMENT — Not an Official Government E-Way Bill",
        pageWidth / 2,
        y + 5.5,
        { align: "center" }
      );

      y += 14;

      // Header: Reference & Status
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(16);
      pdf.text(`REFERENCE: ${bill.ewb_number}`, margin, y);

      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Date: ${formatDate(bill.dispatch_date)}`, pageWidth - margin, y - 1, { align: "right" });
      pdf.text(`Status: ${bill.status}`, pageWidth - margin, y + 5, { align: "right" });

      y += 10;

      // Consignor & Consignee Box
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.3);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, contentWidth, 34, 2, 2, "FD");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text("DISPATCH FROM (CONSIGNOR)", margin + 4, y + 6);
      pdf.text("DELIVER TO (CONSIGNEE)", margin + contentWidth / 2 + 4, y + 6);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);

      // Left: Dispatch From
      let leftY = y + 11;
      pdf.text(bill.dispatch_from_name || "SmartBilling Plant", margin + 4, leftY);
      leftY += 4.5;
      if (bill.dispatch_from_gstin) {
        pdf.text(`GSTIN: ${bill.dispatch_from_gstin}`, margin + 4, leftY);
        leftY += 4.5;
      }
      const fromAddr = pdf.splitTextToSize(bill.dispatch_from_address || "Surat, Gujarat", contentWidth / 2 - 8);
      pdf.text(fromAddr, margin + 4, leftY);

      // Right: Deliver To
      let rightY = y + 11;
      pdf.text(bill.customer_name || "Customer", margin + contentWidth / 2 + 4, rightY);
      rightY += 4.5;
      if (bill.customer_gstin) {
        pdf.text(`GSTIN: ${bill.customer_gstin}`, margin + contentWidth / 2 + 4, rightY);
        rightY += 4.5;
      }
      const toAddr = pdf.splitTextToSize(bill.shipping_address || bill.billing_address || "Delivery Address", contentWidth / 2 - 8);
      pdf.text(toAddr, margin + contentWidth / 2 + 4, rightY);

      y += 40;

      // Transportation Details Box
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(margin, y, contentWidth, 22, 2, 2, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
      pdf.text("PART-B: TRANSPORT & VEHICLE PARTICULARS", margin + 4, y + 5.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);

      const col1X = margin + 4;
      const col2X = margin + 48;
      const col3X = margin + 102;
      const col4X = margin + 145;

      pdf.text(`Mode: ${bill.transport_mode || "ROAD"}`, col1X, y + 11);
      pdf.text(`Distance: ${bill.distance_km || 0} KM`, col1X, y + 16);

      pdf.text(`Vehicle No: ${bill.vehicle_number || "-"}`, col2X, y + 11);
      pdf.text(`Vehicle Type: ${bill.vehicle_type || "REGULAR"}`, col2X, y + 16);

      pdf.text(`Transporter: ${bill.transporter_name || "Self / Plant"}`, col3X, y + 11);
      pdf.text(`Transporter ID: ${bill.transporter_id || "-"}`, col3X, y + 16);

      pdf.text(`Driver: ${bill.driver_name || "-"}`, col4X, y + 11);
      pdf.text(`Mobile: ${bill.driver_mobile || "-"}`, col4X, y + 16);

      y += 28;

      // Reference Documents
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      const refs = [
        bill.invoice_no ? `Linked Invoice: ${bill.invoice_no} (${formatDate(bill.invoice_date)})` : "",
        bill.dispatch_no ? `Linked Dispatch: ${bill.dispatch_no}` : "",
      ]
        .filter(Boolean)
        .join("   |   ");
      if (refs) {
        pdf.text(refs, margin, y);
        y += 6;
      }

      // Items Table
      const tableHeaders = ["#", "Item Description", "HSN", "Qty", "Rate", "Taxable", "GST", "Total"];
      const colW = [8, 62, 18, 18, 20, 24, 18, 24];

      pdf.setFillColor(15, 23, 42);
      pdf.rect(margin, y, contentWidth, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);

      let curX = margin;
      tableHeaders.forEach((th, idx) => {
        const align = idx >= 3 ? "right" : "left";
        const tx = align === "right" ? curX + colW[idx] - 2 : curX + 2;
        pdf.text(th, tx, y + 4.8, { align });
        curX += colW[idx];
      });

      y += 7;

      // Table Rows
      pdf.setTextColor(30, 41, 59);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      (bill.items || []).forEach((item, index) => {
        pdf.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
        pdf.rect(margin, y, contentWidth, 6.5, "F");

        let rx = margin;
        // #
        pdf.text(String(index + 1), rx + 2, y + 4.5);
        rx += colW[0];
        // Product
        pdf.text(pdf.splitTextToSize(item.product_name, colW[1] - 3)[0] || item.product_name, rx + 2, y + 4.5);
        rx += colW[1];
        // HSN
        pdf.text(item.hsn_code || "3915", rx + 2, y + 4.5);
        rx += colW[2];
        // Qty
        pdf.text(`${Number(item.quantity)} ${item.unit || "KG"}`, rx + colW[3] - 2, y + 4.5, { align: "right" });
        rx += colW[3];
        // Rate
        pdf.text(formatCurrency(item.rate), rx + colW[4] - 2, y + 4.5, { align: "right" });
        rx += colW[4];
        // Taxable
        pdf.text(formatCurrency(item.taxable_amount), rx + colW[5] - 2, y + 4.5, { align: "right" });
        rx += colW[5];
        // GST
        pdf.text(formatCurrency(item.tax_amount), rx + colW[6] - 2, y + 4.5, { align: "right" });
        rx += colW[6];
        // Total
        pdf.text(formatCurrency(item.total_amount), rx + colW[7] - 2, y + 4.5, { align: "right" });

        y += 6.5;
      });

      // Total Row
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, contentWidth, 7.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.text("TOTAL CONSIGNMENT VALUE", margin + 4, y + 5);

      pdf.text(formatCurrency(bill.total_taxable_amount), margin + 126, y + 5, { align: "right" });
      pdf.text(formatCurrency(bill.total_tax_amount), margin + 144, y + 5, { align: "right" });
      pdf.text(formatCurrency(bill.total_amount), margin + contentWidth - 2, y + 5, { align: "right" });

      y += 18;

      // Signatures
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setDrawColor(148, 163, 184);
      pdf.line(margin + 10, y + 10, margin + 70, y + 10);
      pdf.line(margin + contentWidth - 70, y + 10, margin + contentWidth - 10, y + 10);

      pdf.text("Transporter / Driver Signature", margin + 40, y + 15, { align: "center" });
      pdf.text("Authorized Warehouse Dispatch Officer", margin + contentWidth - 40, y + 15, { align: "center" });

      // Bottom Note
      y += 24;
      pdf.setFontSize(7.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        "Notice: This document is generated for internal factory dispatch tracking and carrier verification.",
        pageWidth / 2,
        y,
        { align: "center" }
      );
      pdf.text(
        "It does not substitute an official government e-way bill under Rule 138 of Central Goods and Services Tax Rules, 2017.",
        pageWidth / 2,
        y + 4,
        { align: "center" }
      );

      pdf.save(`${bill.ewb_number}_Internal_Transport_Document.pdf`);
    } catch (pdfErr) {
      console.error("PDF Export Error:", pdfErr);
      alert("Failed to generate PDF document");
    }
  };

  // Filtered List
  const filteredBills = useMemo(() => {
    return ewayBills.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (customerFilter && String(b.customer_id) !== String(customerFilter)) return false;
      if (fromDate && b.dispatch_date < fromDate) return false;
      if (toDate && b.dispatch_date > toDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const refMatch = (b.ewb_number || "").toLowerCase().includes(q);
        const invMatch = (b.invoice_no || "").toLowerCase().includes(q);
        const dispMatch = (b.dispatch_no || "").toLowerCase().includes(q);
        const custMatch = (b.customer_name || "").toLowerCase().includes(q);
        const vehMatch = (b.vehicle_number || "").toLowerCase().includes(q);
        const transMatch = (b.transporter_name || "").toLowerCase().includes(q);
        if (!refMatch && !invMatch && !dispMatch && !custMatch && !vehMatch && !transMatch) return false;
      }

      return true;
    });
  }, [ewayBills, statusFilter, customerFilter, fromDate, toDate, searchQuery]);

  // Allowed next status options for status transition modal
  const nextStatusOptions = useMemo(() => {
    if (!selectedBill) return [];
    switch (selectedBill.status) {
      case "DRAFT":
        return [
          { value: "READY_FOR_DISPATCH", label: "Ready for Dispatch" },
          { value: "CANCELLED", label: "Cancelled" },
        ];
      case "READY_FOR_DISPATCH":
        return [
          { value: "DISPATCHED", label: "Dispatched (In Transit)" },
          { value: "DRAFT", label: "Revert to Draft" },
          { value: "CANCELLED", label: "Cancelled" },
        ];
      case "DISPATCHED":
        return [
          { value: "COMPLETED", label: "Completed (Delivered)" },
          { value: "CANCELLED", label: "Cancelled" },
        ];
      default:
        return [];
    }
  }, [selectedBill]);

  if (loading && ewayBills.length === 0) {
    return <LoadingScreen title="Loading Internal E-Way Bills..." subtitle="Fetching transport documents..." />;
  }

  return (
    <div className="ewb-container">
      {/* Top Header */}
      <PageHeader
        title="Internal E-Way Bill Management"
        subtitle="Internal transport document preparation and carrier dispatch workflow without external government API"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setFormData({
                invoice_id: null,
                invoice_no: "",
                invoice_date: "",
                dispatch_id: null,
                dispatch_no: "",
                customer_id: null,
                customer_name: "",
                customer_gstin: "",
                customer_phone: "",
                customer_email: "",
                billing_address: "",
                shipping_address: "",
                dispatch_from_name: "SmartBilling Recycled Polymers Plant",
                dispatch_from_gstin: "",
                dispatch_from_address: "",
                transport_mode: "ROAD",
                distance_km: 50,
                transporter_name: "",
                transporter_id: "",
                vehicle_id: null,
                vehicle_number: "",
                vehicle_type: "REGULAR",
                driver_name: "",
                driver_mobile: "",
                dispatch_date: new Date().toISOString().split("T")[0],
                status: "DRAFT",
                notes: "",
                items: [],
              });
              setSourceType("INVOICE");
              setSelectedSourceId("");
              setCreateModalOpen(true);
            }}
          >
            + New Internal E-Way Bill
          </Button>
        }
      />

      {/* Top Legal Disclaimer Banner */}
      <div className="ewb-disclaimer-banner">
        <span className="ewb-disclaimer-icon">⚠️</span>
        <div>
          <strong>INTERNAL TRANSPORT / E-WAY BILL PREPARATION DOCUMENT</strong> — Not an Official Government E-Way Bill.
          <span className="ewb-disclaimer-sub">
            {" "}This document is strictly for internal carrier documentation, vehicle dispatch gate passes, and transport recording. It does not replace the statutory GST E-Way Bill generated on the official government portal (ewaybillgst.gov.in).
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="ewb-kpi-grid">
        <div className="ewb-kpi-card">
          <span className="ewb-kpi-label">Total Documents</span>
          <span className="ewb-kpi-val">{kpis.total}</span>
          <span className="ewb-kpi-sub">{formatCurrency(kpis.totalValue)} Value</span>
        </div>
        <div className="ewb-kpi-card">
          <span className="ewb-kpi-label">Drafts</span>
          <span className="ewb-kpi-val" style={{ color: "#6b7280" }}>{kpis.draft}</span>
          <span className="ewb-kpi-sub">Preparing transport</span>
        </div>
        <div className="ewb-kpi-card">
          <span className="ewb-kpi-label">Ready for Dispatch</span>
          <span className="ewb-kpi-val" style={{ color: "#2563eb" }}>{kpis.ready}</span>
          <span className="ewb-kpi-sub">Document ready</span>
        </div>
        <div className="ewb-kpi-card">
          <span className="ewb-kpi-label">Dispatched (Transit)</span>
          <span className="ewb-kpi-val" style={{ color: "#d97706" }}>{kpis.dispatched}</span>
          <span className="ewb-kpi-sub">Vehicle on road</span>
        </div>
        <div className="ewb-kpi-card">
          <span className="ewb-kpi-label">Completed</span>
          <span className="ewb-kpi-val" style={{ color: "#16a34a" }}>{kpis.completed}</span>
          <span className="ewb-kpi-sub">Delivered & verified</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="ewb-filter-bar">
        <div className="ewb-filter-left">
          <input
            type="text"
            className="sb-input ewb-search-input"
            placeholder="Search Reference #, Invoice #, Customer, Vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="sb-input ewb-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            className="sb-input ewb-select"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="sb-input ewb-date-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="Dispatch From Date"
          />
          <input
            type="date"
            className="sb-input ewb-date-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="Dispatch To Date"
          />
          {(searchQuery || statusFilter || customerFilter || fromDate || toDate) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("");
                setCustomerFilter("");
                setFromDate("");
                setToDate("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Master Data Table */}
      <Card noPadding>
        <DataTable
          headers={[
            "#",
            "Internal Ref #",
            "Source Ref",
            "Customer Details",
            "Vehicle & Transporter",
            "Dispatch Date",
            "Consignment Value",
            "Status",
            "Actions",
          ]}
        >
          {filteredBills.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>🚚</span>
                <strong>No Internal E-Way Bills Found</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  Create an internal transport document or select an invoice/dispatch to auto-fill.
                </p>
              </td>
            </tr>
          ) : (
            filteredBills.map((b, idx) => {
              const statusClass =
                b.status === "DRAFT"
                  ? "ewb-badge-draft"
                  : b.status === "READY_FOR_DISPATCH"
                  ? "ewb-badge-ready"
                  : b.status === "DISPATCHED"
                  ? "ewb-badge-dispatched"
                  : b.status === "COMPLETED"
                  ? "ewb-badge-completed"
                  : "ewb-badge-cancelled";

              return (
                <tr key={b.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong style={{ color: "#0f172a", fontFamily: "monospace", fontSize: "13px" }}>
                      {b.ewb_number}
                    </strong>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                      {b.invoice_no && <span>🧾 {b.invoice_no}</span>}
                      {b.dispatch_no && <span>🚚 {b.dispatch_no}</span>}
                      {!b.invoice_no && !b.dispatch_no && <span style={{ color: "#94a3b8" }}>Manual</span>}
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{b.customer_name}</strong>
                      {b.customer_phone && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>📞 {b.customer_phone}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong style={{ letterSpacing: "0.5px" }}>{b.vehicle_number}</strong>
                      {b.transporter_name && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>🏢 {b.transporter_name}</div>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(b.dispatch_date)}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>
                      {formatCurrency(b.total_amount)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {Number(b.total_weight_kg) || 0} KG
                    </div>
                  </td>
                  <td>
                    <span className={`ewb-badge ${statusClass}`}>{b.status.replace(/_/g, " ")}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleViewDocument(b.id)}
                        title="View & Print Document"
                      >
                        🖨️ View
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadPDF(b)}
                        title="Download PDF Document"
                      >
                        📥 PDF
                      </Button>
                      {!["COMPLETED", "CANCELLED"].includes(b.status) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditBill(b)}
                          title="Edit Document"
                        >
                          ✏️ Edit
                        </Button>
                      )}
                      {!["COMPLETED", "CANCELLED"].includes(b.status) && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenStatusModal(b)}
                          title="Progress Status"
                        >
                          ⚡ Status
                        </Button>
                      )}
                      {b.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteBill(b.id, b.ewb_number)}
                          title="Delete Draft"
                        >
                          🗑️
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </DataTable>
      </Card>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={formData.id ? `Edit Internal E-Way Bill: ${formData.ewb_number || ""}` : "Create Internal E-Way Bill"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          {/* Modal Legal Disclaimer */}
          <div className="ewb-modal-disclaimer">
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <div>
              <strong>INTERNAL TRANSPORT PREPARATION ONLY</strong> — Not an official government GST E-Way Bill.
              <div style={{ fontSize: "11px", color: "#b45309", marginTop: "2px" }}>
                Generate official E-Way Bills directly on the NIC government portal (ewaybillgst.gov.in) when required by statutory thresholds.
              </div>
            </div>
          </div>

          {/* Source Selection (only on new) */}
          {!formData.id && (
            <div className="ewb-form-section">
              <div className="ewb-form-section-title">
                <span>🔄</span> 1. Select Auto-Fill Source (Zero Duplicate Entry)
              </div>
              <div style={{ display: "flex", gap: "16px", marginBottom: "12px", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === "INVOICE"}
                    onChange={() => {
                      setSourceType("INVOICE");
                      setSelectedSourceId("");
                    }}
                  />
                  <span>From Invoice</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === "DISPATCH"}
                    onChange={() => {
                      setSourceType("DISPATCH");
                      setSelectedSourceId("");
                    }}
                  />
                  <span>From Dispatch</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === "MANUAL"}
                    onChange={() => {
                      setSourceType("MANUAL");
                      setSelectedSourceId("");
                    }}
                  />
                  <span>Manual Entry</span>
                </label>
              </div>

              {sourceType === "INVOICE" && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="sb-input"
                    value={selectedSourceId}
                    onChange={(e) => {
                      setSelectedSourceId(e.target.value);
                      loadSourceData("INVOICE", e.target.value);
                    }}
                  >
                    <option value="">-- Choose Existing Invoice to Auto-Fill --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_no} — {inv.customer_name || "Customer"} ({formatCurrency(inv.grand_total)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sourceType === "DISPATCH" && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="sb-input"
                    value={selectedSourceId}
                    onChange={(e) => {
                      setSelectedSourceId(e.target.value);
                      loadSourceData("DISPATCH", e.target.value);
                    }}
                  >
                    <option value="">-- Choose Existing Dispatch to Auto-Fill --</option>
                    {dispatches.map((dsp) => (
                      <option key={dsp.id} value={dsp.id}>
                        {dsp.dispatch_no} — {dsp.customer_name || "Customer"} (Veh: {dsp.vehicle_number || "Pending"})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Part A: Consignor & Consignee */}
          <div className="ewb-form-section">
            <div className="ewb-form-section-title">
              <span>🏢</span> 2. Consignor & Consignee Details
            </div>
            <div className="ewb-form-grid">
              <div>
                <label className="sb-label">Customer / Consignee Name *</label>
                <input
                  type="text"
                  className="sb-input"
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Customer Mobile</label>
                <input
                  type="text"
                  className="sb-input"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Customer GSTIN</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. 24ABCDE1234F1Z5"
                  value={formData.customer_gstin}
                  onChange={(e) => setFormData({ ...formData, customer_gstin: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Dispatch Date *</label>
                <input
                  type="date"
                  className="sb-input"
                  required
                  value={formData.dispatch_date}
                  onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="sb-label">Delivery / Shipping Destination Address *</label>
                <textarea
                  className="sb-input"
                  rows="2"
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Part B: Vehicle & Transport */}
          <div className="ewb-form-section">
            <div className="ewb-form-section-title">
              <span>🚛</span> 3. Transportation & Vehicle Details
            </div>
            <div className="ewb-form-grid">
              <div>
                <label className="sb-label">Vehicle Number *</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. GJ-05-BT-1234"
                  required
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="sb-label">Select from Vehicle Master</label>
                <select
                  className="sb-input"
                  value={formData.vehicle_id || ""}
                  onChange={(e) => {
                    const vid = e.target.value;
                    const v = vehicles.find((x) => String(x.id) === String(vid));
                    if (v) {
                      setFormData((prev) => ({
                        ...prev,
                        vehicle_id: v.id,
                        vehicle_number: v.vehicle_number,
                        vehicle_type: v.vehicle_type || prev.vehicle_type,
                        transporter_name: v.transporter_name || prev.transporter_name,
                        driver_name: v.driver_name || prev.driver_name,
                        driver_mobile: v.driver_mobile || prev.driver_mobile,
                      }));
                    }
                  }}
                >
                  <option value="">-- Choose Registered Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.transporter_name || "Self"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sb-label">Transport Mode</label>
                <select
                  className="sb-input"
                  value={formData.transport_mode}
                  onChange={(e) => setFormData({ ...formData, transport_mode: e.target.value })}
                >
                  <option value="ROAD">Road</option>
                  <option value="RAIL">Rail</option>
                  <option value="AIR">Air</option>
                  <option value="SHIP">Ship</option>
                </select>
              </div>
              <div>
                <label className="sb-label">Approx Distance (KM)</label>
                <input
                  type="number"
                  className="sb-input"
                  min="0"
                  value={formData.distance_km}
                  onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Transporter Name</label>
                <input
                  type="text"
                  className="sb-input"
                  value={formData.transporter_name}
                  onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Driver Name</label>
                <input
                  type="text"
                  className="sb-input"
                  value={formData.driver_name}
                  onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Driver Mobile</label>
                <input
                  type="text"
                  className="sb-input"
                  value={formData.driver_mobile}
                  onChange={(e) => setFormData({ ...formData, driver_mobile: e.target.value })}
                />
              </div>
              <div>
                <label className="sb-label">Initial Status</label>
                <select
                  className="sb-input"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={Boolean(formData.id)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
                </select>
              </div>
            </div>
          </div>

          {/* Part C: Consignment Items */}
          <div className="ewb-form-section">
            <div className="ewb-form-section-title">
              <span>📦</span> 4. Consignment Line Items
            </div>

            {/* Existing Items Table */}
            {formData.items.length > 0 && (
              <table className="ewb-doc-table" style={{ marginBottom: "16px" }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>HSN</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">GST</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{it.product_name}</td>
                      <td>{it.hsn_code}</td>
                      <td className="text-right">{it.quantity} {it.unit}</td>
                      <td className="text-right">{formatCurrency(it.rate)}</td>
                      <td className="text-right">{formatCurrency(it.taxable_amount)}</td>
                      <td className="text-right">{formatCurrency(it.tax_amount)}</td>
                      <td className="text-right">{formatCurrency(it.total_amount)}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ padding: "2px 6px", fontSize: "11px", borderRadius: "4px" }}
                          onClick={() => handleRemoveItem(idx)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Add New Item Sub-form */}
            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <div style={{ fontWeight: 600, fontSize: "12px", marginBottom: "8px", color: "#334155" }}>
                + Add Item
              </div>
              <div className="ewb-item-row">
                <input
                  type="text"
                  className="sb-input"
                  placeholder="Product Description"
                  value={newItem.product_name}
                  onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                />
                <input
                  type="text"
                  className="sb-input"
                  placeholder="HSN (e.g. 3915)"
                  value={newItem.hsn_code}
                  onChange={(e) => setNewItem({ ...newItem, hsn_code: e.target.value })}
                />
                <input
                  type="number"
                  className="sb-input"
                  placeholder="Quantity"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
                <select
                  className="sb-input"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                >
                  <option value="KG">KG</option>
                  <option value="TON">TON</option>
                  <option value="BAGS">BAGS</option>
                  <option value="PCS">PCS</option>
                </select>
                <input
                  type="number"
                  className="sb-input"
                  placeholder="Rate (₹)"
                  min="0"
                  step="0.01"
                  value={newItem.rate}
                  onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                />
                <input
                  type="number"
                  className="sb-input"
                  placeholder="GST %"
                  value={newItem.tax_percent}
                  onChange={(e) => setNewItem({ ...newItem, tax_percent: e.target.value })}
                />
                <button
                  type="button"
                  className="sb-btn-secondary"
                  onClick={handleAddItem}
                  style={{ height: "38px" }}
                  title="Add Item"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : formData.id ? "Update E-Way Bill" : "Save Internal E-Way Bill"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DOCUMENT VIEW & PRINT / PDF MODAL */}
      <Modal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        title={`Internal Transport Document — ${selectedBill?.ewb_number || ""}`}
        size="lg"
      >
        {selectedBill && (
          <div>
            {/* Top Toolbar in Modal */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "16px" }}>
              <Button variant="secondary" onClick={() => window.print()}>
                🖨️ Print
              </Button>
              <Button variant="primary" onClick={() => handleDownloadPDF(selectedBill)}>
                📥 Download PDF
              </Button>
            </div>

            {/* Printable Document Sheet */}
            <div className="ewb-doc-preview-wrap" id="printable-ewb-doc">
              {/* Top Banner */}
              <div className="ewb-doc-header-banner">
                <h2 className="ewb-doc-title">INTERNAL TRANSPORT / E-WAY BILL PREPARATION DOCUMENT</h2>
                <span className="ewb-doc-disclaimer">
                  Not an Official Government E-Way Bill (Internal Warehouse / Transit Management)
                </span>
              </div>

              {/* Document Reference Info */}
              <div className="ewb-doc-meta-grid">
                <div className="ewb-meta-col">
                  <div className="ewb-meta-item">
                    <strong>Internal Reference No:</strong> {selectedBill.ewb_number}
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Dispatch Date:</strong> {formatDate(selectedBill.dispatch_date)}
                  </div>
                  {selectedBill.invoice_no && (
                    <div className="ewb-meta-item">
                      <strong>Tax Invoice #:</strong> {selectedBill.invoice_no} ({formatDate(selectedBill.invoice_date)})
                    </div>
                  )}
                  {selectedBill.dispatch_no && (
                    <div className="ewb-meta-item">
                      <strong>Dispatch Memo #:</strong> {selectedBill.dispatch_no}
                    </div>
                  )}
                </div>
                <div className="ewb-meta-col" style={{ textAlign: "right" }}>
                  <div className="ewb-meta-item">
                    <strong>Status:</strong>{" "}
                    <span className="ewb-badge ewb-badge-ready">{selectedBill.status}</span>
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Generated At:</strong> {new Date().toLocaleString("en-IN")}
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Approx Distance:</strong> {selectedBill.distance_km || 0} KM
                  </div>
                </div>
              </div>

              {/* Part A: Parties */}
              <div className="ewb-doc-section-title">Part A: Consignor & Consignee Particulars</div>
              <div className="ewb-doc-parties-grid">
                <div className="ewb-doc-party-card">
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Dispatch From (Consignor)
                  </div>
                  <div className="ewb-doc-party-name">
                    {selectedBill.dispatch_from_name || "SmartBilling Plant"}
                  </div>
                  {selectedBill.dispatch_from_gstin && (
                    <div><strong>GSTIN:</strong> {selectedBill.dispatch_from_gstin}</div>
                  )}
                  <div><strong>Address:</strong> {selectedBill.dispatch_from_address || "Kim Industrial Area, Surat"}</div>
                </div>

                <div className="ewb-doc-party-card">
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Deliver To (Consignee)
                  </div>
                  <div className="ewb-doc-party-name">{selectedBill.customer_name}</div>
                  {selectedBill.customer_gstin && (
                    <div><strong>GSTIN:</strong> {selectedBill.customer_gstin}</div>
                  )}
                  {selectedBill.customer_phone && (
                    <div><strong>Contact:</strong> 📞 {selectedBill.customer_phone}</div>
                  )}
                  <div><strong>Shipping Address:</strong> {selectedBill.shipping_address || selectedBill.billing_address}</div>
                </div>
              </div>

              {/* Part B: Transport & Carrier Details */}
              <div className="ewb-doc-section-title">Part B: Carrier & Vehicle Particulars</div>
              <div className="ewb-doc-meta-grid" style={{ marginBottom: "16px" }}>
                <div className="ewb-meta-col">
                  <div className="ewb-meta-item">
                    <strong>Transport Mode:</strong> {selectedBill.transport_mode || "ROAD"}
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Vehicle Registration #:</strong>{" "}
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                      {selectedBill.vehicle_number}
                    </span>
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Vehicle Type:</strong> {selectedBill.vehicle_type || "REGULAR"}
                  </div>
                </div>
                <div className="ewb-meta-col">
                  <div className="ewb-meta-item">
                    <strong>Transporter Name:</strong> {selectedBill.transporter_name || "Self / Factory Fleet"}
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Driver Name:</strong> {selectedBill.driver_name || "-"}
                  </div>
                  <div className="ewb-meta-item">
                    <strong>Driver Mobile:</strong> {selectedBill.driver_mobile || "-"}
                  </div>
                </div>
              </div>

              {/* Goods Table */}
              <div className="ewb-doc-section-title">Consignment Goods & Tax Breakdown</div>
              <table className="ewb-doc-table">
                <thead>
                  <tr>
                    <th style={{ width: "35px" }}>#</th>
                    <th>Product Description</th>
                    <th>HSN</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">GST Rate</th>
                    <th className="text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBill.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{it.product_name}</strong>
                      </td>
                      <td><code>{it.hsn_code || "3915"}</code></td>
                      <td className="text-right">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="text-right">{formatCurrency(it.rate)}</td>
                      <td className="text-right">{formatCurrency(it.taxable_amount)}</td>
                      <td className="text-right">{it.tax_percent}% ({formatCurrency(it.tax_amount)})</td>
                      <td className="text-right">
                        <strong>{formatCurrency(it.total_amount)}</strong>
                      </td>
                    </tr>
                  ))}
                  <tr className="ewb-doc-total-row">
                    <td colSpan="3" style={{ textAlign: "right" }}>
                      TOTAL CONSIGNMENT VALUE:
                    </td>
                    <td className="text-right">{selectedBill.total_weight_kg || 0} KG</td>
                    <td></td>
                    <td className="text-right">{formatCurrency(selectedBill.total_taxable_amount)}</td>
                    <td className="text-right">+{formatCurrency(selectedBill.total_tax_amount)}</td>
                    <td className="text-right" style={{ fontSize: "14px", color: "#0f172a" }}>
                      {formatCurrency(selectedBill.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="ewb-doc-signatures">
                <div className="ewb-sign-block">
                  Signature of Carrier / Driver<br />
                  ({selectedBill.driver_name || "Driver"})
                </div>
                <div className="ewb-sign-block">
                  Authorized Warehouse Officer<br />
                  SmartBilling Polymers Plant
                </div>
              </div>

              {/* Disclaimer */}
              <div className="ewb-doc-footer-note">
                Notice: This internal transport preparation document is generated by SmartBilling ERP for warehouse dispatch management, driver routing, and material handling. It is not an official government-issued E-Way Bill under Rule 138 of CGST Rules, 2017.
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* STATUS UPDATE MODAL */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Update E-Way Bill Status: ${selectedBill?.ewb_number || ""}`}
        size="sm"
      >
        {selectedBill && (
          <div>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
              Current Status: <strong>{selectedBill.status}</strong>
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label className="sb-label">Transition To New Status:</label>
              <select
                className="sb-input"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
              >
                <option value="">-- Choose Next Status --</option>
                {nextStatusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!targetStatus || submitting}
                onClick={handleConfirmStatusChange}
              >
                {submitting ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticEWayBills;
