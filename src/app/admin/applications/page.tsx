'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  CheckCircle, 
  Archive,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw
} from 'lucide-react';

type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  positionApplyingFor: string;
  preferredStore: string;
  desiredPay: string | null;
  availableStartDate: string | null;
  employmentType: string;
  availability: Record<string, { available: boolean; startTime?: string; endTime?: string }> | null;
  authorizedToWork: boolean;
  hasReliableTransportation: boolean;
  hasValidDriversLicense: boolean;
  workedHereBefore: boolean;
  workedHereBeforeExplanation: string | null;
  yearsAutomotiveExperience: string | null;
  yearsTireExperience: string | null;
  customerServiceExperience: string | null;
  salesExperience: string | null;
  isAseCertified: boolean;
  hasForkliftExperience: boolean;
  hasAlignmentExperience: boolean;
  hasTpmsExperience: boolean;
  hasMountingBalancingExperience: boolean;
  hasOilChangeExperience: boolean;
  hasBrakeExperience: boolean;
  hasSuspensionExperience: boolean;
  employmentHistory: Array<{
    company: string;
    position: string;
    supervisor?: string;
    phone?: string;
    startDate?: string;
    endDate?: string;
    reasonForLeaving?: string;
    responsibilities?: string;
  }> | null;
  highestEducation: string | null;
  references: Array<{
    name: string;
    relationship: string;
    phone: string;
  }> | null;
  resumeUrl: string | null;
  resumeFilename: string | null;
  heardAboutUs: string | null;
  additionalComments: string | null;
  electronicSignature: string;
  signatureDate: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'reviewing', label: 'Reviewing', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'interviewed', label: 'Interviewed', color: 'bg-purple-100 text-purple-800' },
  { value: 'hired', label: 'Hired', color: 'bg-green-100 text-green-800' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-800' },
];

export default function ApplicationsAdminPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  
  // Detail view
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchApplications = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (positionFilter) params.set('position', positionFilter);
      if (storeFilter) params.set('store', storeFilter);
      
      const res = await fetch(`/api/admin/applications?${params}`);
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to fetch applications');
        return;
      }
      
      setApplications(data.applications || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError('Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [page, statusFilter, positionFilter, storeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const updateStatus = async (id: string, newStatus: string, notes?: string) => {
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reviewNotes: notes }),
      });
      
      if (res.ok) {
        fetchApplications();
        if (selectedApp?.id === id) {
          setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employment Applications</h1>
              <p className="text-gray-600 mt-1">{total} total applications</p>
            </div>
            <button
              onClick={fetchApplications}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={positionFilter}
              onChange={(e) => { setPositionFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Positions</option>
              <option value="Tire Technician">Tire Technician</option>
              <option value="Service Technician">Service Technician</option>
              <option value="Sales Associate">Sales Associate</option>
              <option value="Office">Office</option>
              <option value="Management">Management</option>
            </select>
            <select
              value={storeFilter}
              onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Stores</option>
              <option value="Pontiac">Pontiac</option>
              <option value="Waterford">Waterford</option>
              <option value="Either">Either</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Applications Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading applications...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No applications found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Applicant</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Position</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Store</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Applied</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{app.firstName} {app.lastName}</p>
                        <p className="text-sm text-gray-500">{app.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{app.positionApplyingFor}</td>
                    <td className="px-6 py-4 text-gray-700">{app.preferredStore}</td>
                    <td className="px-6 py-4">{getStatusBadge(app.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(app.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {app.resumeUrl && (
                          <a
                            href={app.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                            title="Download Resume"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedApp.firstName} {selectedApp.lastName}
                </h2>
                <p className="text-gray-600">{selectedApp.positionApplyingFor} • {selectedApp.preferredStore}</p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Status & Actions */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                <span className="font-medium text-gray-700">Status:</span>
                <select
                  value={selectedApp.status}
                  onChange={(e) => updateStatus(selectedApp.id, e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {selectedApp.resumeUrl && (
                  <a
                    href={selectedApp.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    Resume
                  </a>
                )}
              </div>

              {/* Contact Info */}
              <section className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <a href={`mailto:${selectedApp.email}`} className="text-red-600 hover:underline">{selectedApp.email}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <a href={`tel:${selectedApp.phone}`} className="text-red-600 hover:underline">{selectedApp.phone}</a>
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span>{selectedApp.streetAddress}, {selectedApp.city}, {selectedApp.state} {selectedApp.zip}</span>
                  </div>
                </div>
              </section>

              {/* Position Details */}
              <section className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Position Details</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Employment Type:</span> <span className="font-medium">{selectedApp.employmentType}</span></div>
                  <div><span className="text-gray-500">Desired Pay:</span> <span className="font-medium">{selectedApp.desiredPay || 'Not specified'}</span></div>
                  <div><span className="text-gray-500">Available Start:</span> <span className="font-medium">{selectedApp.availableStartDate || 'Not specified'}</span></div>
                </div>
              </section>

              {/* Qualifications */}
              <section className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Qualifications</h3>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <div className={selectedApp.authorizedToWork ? 'text-green-700' : 'text-red-700'}>
                    {selectedApp.authorizedToWork ? '✓' : '✗'} Authorized to work in US
                  </div>
                  <div className={selectedApp.hasReliableTransportation ? 'text-green-700' : 'text-red-700'}>
                    {selectedApp.hasReliableTransportation ? '✓' : '✗'} Reliable transportation
                  </div>
                  <div className={selectedApp.hasValidDriversLicense ? 'text-green-700' : 'text-red-700'}>
                    {selectedApp.hasValidDriversLicense ? '✓' : '✗'} Valid driver's license
                  </div>
                  <div>
                    {selectedApp.workedHereBefore ? `✓ Worked here before: ${selectedApp.workedHereBeforeExplanation || ''}` : '✗ Never worked here'}
                  </div>
                </div>
              </section>

              {/* Experience */}
              <section className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Experience</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Automotive:</span> <span className="font-medium">{selectedApp.yearsAutomotiveExperience || '0'} years</span></div>
                  <div><span className="text-gray-500">Tire:</span> <span className="font-medium">{selectedApp.yearsTireExperience || '0'} years</span></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedApp.isAseCertified && <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">ASE Certified</span>}
                  {selectedApp.hasForkliftExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Forklift</span>}
                  {selectedApp.hasAlignmentExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Alignment</span>}
                  {selectedApp.hasTpmsExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">TPMS</span>}
                  {selectedApp.hasMountingBalancingExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Mount & Balance</span>}
                  {selectedApp.hasOilChangeExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Oil Change</span>}
                  {selectedApp.hasBrakeExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Brakes</span>}
                  {selectedApp.hasSuspensionExperience && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Suspension</span>}
                </div>
              </section>

              {/* Employment History */}
              {selectedApp.employmentHistory && selectedApp.employmentHistory.length > 0 && (
                <section className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Employment History</h3>
                  <div className="space-y-4">
                    {selectedApp.employmentHistory.map((emp, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium">{emp.company} - {emp.position}</p>
                        <p className="text-sm text-gray-600">{emp.startDate} - {emp.endDate}</p>
                        {emp.responsibilities && <p className="text-sm mt-2">{emp.responsibilities}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* References */}
              {selectedApp.references && selectedApp.references.length > 0 && (
                <section className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">References</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {selectedApp.references.map((ref, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium">{ref.name}</p>
                        <p className="text-sm text-gray-600">{ref.relationship}</p>
                        <a href={`tel:${ref.phone}`} className="text-sm text-red-600 hover:underline">{ref.phone}</a>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Additional Comments */}
              {selectedApp.additionalComments && (
                <section className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Additional Comments</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedApp.additionalComments}</p>
                </section>
              )}

              {/* Signature */}
              <section className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">
                  <strong>Electronically signed:</strong> {selectedApp.electronicSignature} on {selectedApp.signatureDate}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Applied: {formatDate(selectedApp.createdAt)}
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
