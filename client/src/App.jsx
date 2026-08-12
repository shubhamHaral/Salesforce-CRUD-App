import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [selectedObject, setSelectedObject] = useState("Account");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  const objects = [
    "Account",
    "Opportunity",
    "Lead",
    "Contact",
    "Case"
  ];
  const objectFields = {
    Account: [
      "Name",
      "Industry",
      "Phone",
      "Website",
      "Type"
    ],

    Opportunity: [
      "Name",
      "StageName",
      "Amount",
      "CloseDate",
      "Type"
    ],

    Lead: [
      "FirstName",
      "LastName",
      "Company",
      "Email",
      "Phone"
    ],

    Contact: [
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "Title"
    ],

    Case: [
      "CaseNumber",
      "Subject",
      "Status",
      "Priority",
      "Origin"
    ]
  };

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (loggedIn) {
      fetchRecords(selectedObject);
    }
  }, [loggedIn, selectedObject]);

  const checkLoginStatus = async () => {
    try {
      const response = await fetch(
        `${API_URL}/auth/status`,
        {
          credentials: "include"
        }
      );

      const data = await response.json();

      setLoggedIn(data.loggedIn);
    } catch (error) {
      console.error(error);
      setError("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const loginWithSalesforce = () => {
    window.location.href = `${API_URL}/auth/login`;
  };

  const fetchRecords = async (objectName) => {
    try {
      setLoadingRecords(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/records/${objectName}`,
        {
          credentials: "include"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details, null, 2);

        throw new Error(
          errorMessage || "Failed to update record"
        );
      }

      setRecords(data.records || []);

    } catch (error) {
      console.error(error);
      setError(error.message);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(formData)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details, null, 2);

        throw new Error(
          errorMessage || "Failed to create record"
        );
      }

      alert("Record created successfully!");

      setFormData({});
      setShowCreateForm(false);

      await fetchRecords(selectedObject);

    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const updateData = {};

      objectFields[selectedObject].forEach((field) => {
        if (
          formData[field] !== undefined &&
          formData[field] !== null
        ) {
          updateData[field] = formData[field];
        }
      });

      console.log("UPDATE DATA:", updateData);

      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}/${editingRecord.Id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(updateData)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details);

        throw new Error(
          message || "Failed to update record"
        );
      }

      alert("Record updated successfully!");

      setEditingRecord(null);
      setShowEditForm(false);
      setFormData({});

      await fetchRecords(selectedObject);

    } catch (error) {
      console.error("Update error:", error);

      setError(
        error.message || "Failed to update record"
      );

    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (recordId) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${selectedObject} record?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}/${recordId}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.details === "string"
            ? data.details
            : JSON.stringify(data.details)
        );
      }

      alert("Record deleted successfully!");

      await fetchRecords(selectedObject);

    } catch (error) {
      console.error("Delete error:", error);

      setError(
        error.message || "Failed to delete record"
      );
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">

      <div className="header">
        <h1>Salesforce CRUD Application</h1>
      </div>

      {!loggedIn ? (
        <div className="login-card">

          <h2>Connect to Salesforce</h2>

          <p>
            Login with your Salesforce account
            to manage records.
          </p>

          <button
            className="login-button"
            onClick={loginWithSalesforce}
          >
            Login with Salesforce
          </button>

        </div>
      ) : (

        <div className="dashboard">


          <div className="toolbar">

            <div>
              <label>
                Select Salesforce Object
              </label>

              <select
                value={selectedObject}
                onChange={(e) =>
                  setSelectedObject(
                    e.target.value
                  )
                }
              >
                {objects.map((object) => (
                  <option
                    key={object}
                    value={object}
                  >
                    {object}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="refresh-button"
              onClick={() =>
                fetchRecords(selectedObject)
              }
            >
              Refresh
            </button>

            <button
              className="create-button"
              onClick={() => {
                setEditingRecord(null);
                setFormData({});
                setShowEditForm(false);
                setShowCreateForm(true);
              }}
            >
              + Create Record
            </button>

          </div>

          {error && (
            <div className="error">
              <strong>Error:</strong>
              <pre>{error}</pre>
            </div>
          )}

          {showCreateForm && (
            <div className="form-card">

              <h2>
                Create {selectedObject}
              </h2>

              <form onSubmit={handleCreate}>

                {objectFields[selectedObject].map(
                  (field) => (

                    <div
                      className="form-group"
                      key={field}
                    >

                      <label>
                        {field}
                      </label>

                      <input
                        type="text"
                        value={formData[field] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [field]: e.target.value
                          })
                        }
                      />
                    </div>

                  )
                )}

                <div className="form-actions">

                  <button
                    type="submit"
                    className="save-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Create"}
                  </button>

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() =>
                      setShowCreateForm(false)
                    }
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </div>
          )}

          {showEditForm && editingRecord && (
            <div className="form-card">

              <h2>
                Edit {selectedObject}
              </h2>

              <form onSubmit={handleUpdate}>

                {objectFields[selectedObject].map(
                  (field) => (

                    <div
                      className="form-group"
                      key={field}
                    >

                      <label>
                        {field}
                      </label>

                      <input
                        type="text"
                        value={formData[field] ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [field]: e.target.value
                          })
                        }
                      />

                    </div>

                  )
                )}

                <div className="form-actions">

                  <button
                    type="submit"
                    className="save-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Updating..."
                      : "Update"}
                  </button>

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => {
                      setShowEditForm(false);
                      setEditingRecord(null);
                      setFormData({});
                    }}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </div>
          )}

          {loadingRecords ? (
            <div className="loading">
              Loading records...
            </div>
          ) : records.length === 0 ? (
            <div className="empty">
              No records found.
            </div>
          ) : (

            <div className="table-container">
              <div className="table-container">

                <table className="records-table">

                  <thead>
                    <tr>

                      {objectFields[selectedObject].map(
                        (field) => (
                          <th key={field}>
                            {field}
                          </th>
                        )
                      )}

                      <th className="actions-header">
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {records.map((record) => (

                      <tr key={record.Id}>

                        {objectFields[selectedObject].map(
                          (field) => (
                            <td key={field}>
                              {record[field] ?? "-"}
                            </td>
                          )
                        )}

                        <td className="actions-cell">

                          <button
                            className="view-button"
                            onClick={() => setViewingRecord(record)}
                          >
                            View
                          </button>

                          <button
                            className="action-button"
                            onClick={() => {
                              setEditingRecord(record);
                              setFormData({ ...record });
                              setShowEditForm(true);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-button"
                            onClick={() =>
                              handleDelete(record.Id)
                            }
                          >
                            Delete
                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          )}
          {viewingRecord && (
            <div
              className="modal-overlay"
              onClick={() => setViewingRecord(null)}
            >
              <div
                className="view-modal"
                onClick={(e) => e.stopPropagation()}
              >

                <div className="modal-header">

                  <h2>
                    {selectedObject} Details
                  </h2>

                  <button
                    className="close-button"
                    onClick={() => setViewingRecord(null)}
                  >
                    ×
                  </button>

                </div>

                <div className="record-details">

                  {objectFields[selectedObject].map(
                    (field) => (
                      <div
                        className="detail-row"
                        key={field}
                      >

                        <div className="detail-label">
                          {field}
                        </div>

                        <div className="detail-value">
                          {viewingRecord[field] ?? "-"}
                        </div>

                      </div>
                    )
                  )}

                </div>

                <div className="modal-footer">

                  <button
                    className="cancel-button"
                    onClick={() => setViewingRecord(null)}
                  >
                    Close
                  </button>

                </div>

              </div>
            </div>
          )}
        </div>

      )}

    </div>
  );
}

export default App;