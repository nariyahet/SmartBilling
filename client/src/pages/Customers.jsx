import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import "./Customers.css";

function Customers() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      const response = await API.get("/customers");

      if (response.data?.success) {
        setCustomers(response.data.customers || []);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Fetch Customers Error:", error);

      alert(error.response?.data?.message || "Unable to load customers");

      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);

        const response = await API.get("/customers");

        if (response.data?.success) {
          setCustomers(response.data.customers || []);
        } else {
          setCustomers([]);
        }
      } catch (error) {
        console.error("Fetch Customers Error:", error);

        alert(error.response?.data?.message || "Unable to load customers");

        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const resetForm = () => {
    setName("");
    setMobile("");
    setEmail("");
    setAddress("");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter customer name");
      return;
    }

    if (!mobile.trim()) {
      alert("Please enter mobile number");
      return;
    }

    if (!/^[0-9+\-\s]{7,15}$/.test(mobile.trim())) {
      alert("Please enter a valid mobile number");
      return;
    }

    try {
      const customerData = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
      };

      if (editingId) {
        const response = await API.put(`/customers/${editingId}`, customerData);

        if (response.data?.success) {
          alert("Customer updated successfully ✅");
        }
      } else {
        const response = await API.post("/customers", customerData);

        if (response.data?.success) {
          alert("Customer added successfully ✅");
        }
      }

      resetForm();

      await fetchCustomers();
    } catch (error) {
      console.error("Save Customer Error:", error);

      alert(error.response?.data?.message || "Unable to save customer");
    }
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);

    setName(customer.name || "");
    setMobile(customer.mobile || "");
    setEmail(customer.email || "");
    setAddress(customer.address || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this customer?",
    );

    if (!confirmed) return;

    try {
      await API.delete(`/customers/${id}`);

      alert("Customer deleted successfully ✅");

      await fetchCustomers();
    } catch (error) {
      if (error.response?.status === 409) {
        alert(
          "This customer cannot be deleted because invoices are linked to this customer.",
        );

        return;
      }

      console.error("Delete Customer Error:", error);

      alert(error.response?.data?.message || "Unable to delete customer");
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const text = search.toLowerCase().trim();

    return (
      customer.name?.toLowerCase().includes(text) ||
      customer.mobile?.toLowerCase().includes(text) ||
      customer.email?.toLowerCase().includes(text) ||
      customer.address?.toLowerCase().includes(text)
    );
  });

  return (
    <div className="customers-page">
      <div className="customers-header">
        <div>
          <h1>
            <i className="fas fa-users"></i>
            Customer Management
          </h1>

          <p>Manage your customers and contact details</p>
        </div>

        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>
      </div>

      <div className="customer-form-card">
        <h2>{editingId ? "✏️ Edit Customer" : "➕ Add Customer"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="customer-form-grid">
            <div className="form-group">
              <label>Customer Name *</label>

              <input
                type="text"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Mobile Number *</label>

              <input
                type="tel"
                placeholder="Enter mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Email</label>

              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group full-width">
              <label>Address</label>

              <textarea
                placeholder="Enter customer address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows="3"
              />
            </div>
          </div>

          <div className="customer-form-actions">
            <button type="submit" className="primary-button">
              {editingId ? "Update Customer" : "Add Customer"}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="customers-card">
        <div className="customers-card-header">
          <div>
            <h2>Customer List</h2>

            <span>{filteredCustomers.length} Customers</span>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={fetchCustomers}
          >
            🔄 Refresh
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by name, mobile, email or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="empty-state">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>

            <h3>{search ? "No Customers Found" : "No Customers Yet"}</h3>

            <p>
              {search
                ? "Try another search."
                : "Add your first customer above."}
            </p>
          </div>
        ) : (
          <div className="customer-table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>#{customer.id}</td>

                    <td>
                      <strong>{customer.name}</strong>
                    </td>

                    <td>{customer.mobile}</td>

                    <td>{customer.email || "—"}</td>

                    <td className="address-cell">{customer.address || "—"}</td>

                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(customer)}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(customer.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Customers;
