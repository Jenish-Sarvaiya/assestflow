import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import QRCode from 'qrcode';
import {
  Plus,
  Search,
  Filter,
  Eye,
  X,
  FileText,
  Calendar,
  CheckCircle,
  HelpCircle,
  Tag,
  Wrench,
  Shuffle,
  QrCode,
  Upload,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface Asset {
  id: number;
  assetTag: string;
  name: string;
  categoryId: number;
  serialNumber: string | null;
  acquisitionDate: string | null;
  acquisitionCost: number | null;
  condition: string;
  locationId: number | null;
  status: 'AVAILABLE' | 'ALLOCATED' | 'RESERVED' | 'UNDER_MAINTENANCE' | 'LOST' | 'RETIRED' | 'DISPOSED';
  isBookable: boolean;
  qrCodeValue: string | null;
  customFieldValues: any;
  nextMaintenanceDueDate: string | null;
  registeredById: number;
  createdAt: string;
  category: { id: number; name: string; customFieldsSchema: any };
  location?: { id: number; name: string } | null;
  allocations?: any[];
  maintenanceRequests?: any[];
  bookings?: any[];
  attachments?: any[];
}

export const AssetDirectory: React.FC = () => {
  const queryClient = useQueryClient();
  const { employee } = useAuthStore();
  const isAssetManager = employee?.role === 'ASSET_MANAGER';

  // Navigation / View States
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);

  // Filters State
  const [filterTag, setFilterTag] = useState('');
  const [filterSerial, setFilterSerial] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterBookable, setFilterBookable] = useState('');

  // Create Form State
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [condition, setCondition] = useState('Good');
  const [locationId, setLocationId] = useState('');
  const [isBookable, setIsBookable] = useState(false);
  const [customFields, setCustomFields] = useState<any>({});
  const [nextMaintenance, setNextMaintenance] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal / Tab States for Detail
  const [detailTab, setDetailTab] = useState<'info' | 'allocations' | 'maintenance'>('info');
  const [qrUrl, setQrUrl] = useState('');

  // Queries
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations'),
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  // Query Assets with active filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filterTag) params.append('tag', filterTag);
    if (filterSerial) params.append('serial', filterSerial);
    if (filterCategory) params.append('categoryId', filterCategory);
    if (filterLocation) params.append('locationId', filterLocation);
    if (filterStatus) params.append('status', filterStatus);
    if (filterDept) params.append('departmentId', filterDept);
    if (filterBookable) params.append('bookable', filterBookable);
    return params.toString();
  };

  const { data: assets = [], isLoading: assetsLoading, refetch } = useQuery<Asset[]>({
    queryKey: ['assets', filterTag, filterSerial, filterCategory, filterLocation, filterStatus, filterDept, filterBookable],
    queryFn: () => api.get(`/assets?${buildQueryString()}`),
  });

  const { data: assetDetail, isLoading: detailLoading } = useQuery<Asset>({
    queryKey: ['asset', selectedAssetId],
    queryFn: () => api.get(`/assets/${selectedAssetId}`),
    enabled: selectedAssetId !== null,
  });

  // Reset Filters
  const handleResetFilters = () => {
    setFilterTag('');
    setFilterSerial('');
    setFilterCategory('');
    setFilterLocation('');
    setFilterStatus('');
    setFilterDept('');
    setFilterBookable('');
  };

  // Dynamically load Custom Fields fields when category changes
  const selectedCategoryObj = categories.find(c => c.id === parseInt(categoryId));
  const categoryFieldsSchema = selectedCategoryObj?.customFieldsSchema || [];

  useEffect(() => {
    // Rebuild customFields object when category changes
    const initialFields: any = {};
    categoryFieldsSchema.forEach((f: any) => {
      initialFields[f.key] = f.type === 'boolean' ? false : '';
    });
    setCustomFields(initialFields);
  }, [categoryId, selectedCategoryObj]);

  // Generate QR code for the selected asset
  useEffect(() => {
    if (assetDetail?.assetTag) {
      QRCode.toDataURL(assetDetail.assetTag, { width: 200, margin: 1 }, (err, url) => {
        if (!err) setQrUrl(url);
      });
    }
  }, [assetDetail]);

  // Mutations
  const createAssetMutation = useMutation({
    mutationFn: (formData: FormData) => {
      return api.post('/assets', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setViewMode('list');
      resetForm();
    },
  });

  const resetForm = () => {
    setName('');
    setCategoryId('');
    setSerialNumber('');
    setAcquisitionDate('');
    setAcquisitionCost('');
    setCondition('Good');
    setLocationId('');
    setIsBookable(false);
    setCustomFields({});
    setNextMaintenance('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('categoryId', categoryId);
    formData.append('serialNumber', serialNumber);
    if (acquisitionDate) formData.append('acquisitionDate', acquisitionDate);
    if (acquisitionCost) formData.append('acquisitionCost', acquisitionCost);
    formData.append('condition', condition);
    if (locationId) formData.append('locationId', locationId);
    formData.append('isBookable', isBookable ? 'true' : 'false');
    formData.append('customFieldValues', JSON.stringify(customFields));
    if (nextMaintenance) formData.append('nextMaintenanceDueDate', nextMaintenance);
    if (selectedFile) {
      formData.append('photo', selectedFile);
    }

    createAssetMutation.mutate(formData);
  };

  const handleCustomFieldChange = (key: string, value: any) => {
    setCustomFields({
      ...customFields,
      [key]: value
    });
  };

  const statusColors = {
    AVAILABLE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    ALLOCATED: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    RESERVED: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    UNDER_MAINTENANCE: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    LOST: 'bg-red-500/10 text-red-400 border border-red-500/20',
    RETIRED: 'bg-slate-500/10 text-slate-400 border border-slate-700/30',
    DISPOSED: 'bg-slate-800/80 text-slate-500 border border-slate-700/20',
  };

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Asset Inventory</h2>
            <p className="text-slate-400 text-sm mt-1">Register physical inventory, audit lifecycle states, and review category specs.</p>
          </div>
          {isAssetManager && (
            <button
              onClick={() => setViewMode('create')}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Asset</span>
            </button>
          )}
        </div>
      )}

      {/* VIEW MODES */}
      
      {/* 1. ASSET LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="glass rounded-2xl p-5 border border-slate-800/80 space-y-4">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Filter className="w-4 h-4" />
              <span>Inventory Filters</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Asset Tag Search */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search Asset Tag (AF-...)"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
                />
              </div>

              {/* Serial Number Search */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search Serial Number"
                  value={filterSerial}
                  onChange={(e) => setFilterSerial(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
                />
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Location Filter */}
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
              >
                <option value="">All Lifecycle Statuses</option>
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="ALLOCATED">ALLOCATED</option>
                <option value="RESERVED">RESERVED</option>
                <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
                <option value="LOST">LOST</option>
                <option value="RETIRED">RETIRED</option>
                <option value="DISPOSED">DISPOSED</option>
              </select>

              {/* Department Allocation Filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
              >
                <option value="">All Allocated Depts</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {/* Bookable status Filter */}
              <select
                value={filterBookable}
                onChange={(e) => setFilterBookable(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl focus:border-primary-500 outline-none transition"
              >
                <option value="">All Types (Bookable & Normal)</option>
                <option value="true">Bookable Shared Resources</option>
                <option value="false">Non-Bookable Assets</option>
              </select>

              {/* Reset Button */}
              <button
                onClick={handleResetFilters}
                className="w-full py-2 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* ASSET DIRECTORY TABLE LIST */}
          {assetsLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Loading asset inventory...</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="glass p-16 rounded-2xl text-center text-slate-400 text-sm border border-slate-800/60">
              <FolderOpen className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <p>No assets match the query criteria. Clear filters or add new assets.</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden border border-slate-800/60">
              <table className="w-full text-left text-sm text-slate-350">
                <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Asset Tag</th>
                    <th className="px-6 py-4">Asset Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Condition</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-850/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-sky-400 tracking-wide text-xs">{asset.assetTag}</td>
                      <td className="px-6 py-4 font-semibold text-white">
                        <div className="flex items-center space-x-2">
                          <span>{asset.name}</span>
                          {asset.isBookable && (
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-purple-500/10 text-purple-400 border border-purple-500/10">
                              Bookable
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{asset.category.name}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {asset.location ? asset.location.name : <span className="text-slate-650 italic">None</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{asset.condition}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          statusColors[asset.status]
                        }`}>
                          {asset.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            setViewMode('detail');
                            setDetailTab('info');
                          }}
                          className="text-xs font-semibold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg transition outline-none cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. REGISTER ASSET FORM */}
      {viewMode === 'create' && (
        <div className="glass-card max-w-3xl mx-auto rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
          
          <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Register New Equipment Asset</h3>
              <p className="text-slate-400 text-xs mt-1">Specify initial parameters. Auto-generates tag tag sequentially.</p>
            </div>
            <button
              onClick={() => {
                setViewMode('list');
                resetForm();
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-750 rounded-lg transition outline-none cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateAssetSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Asset Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell Latitude Laptop 14"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Asset Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Serial Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Serial Number / Unique UUID</label>
                <input
                  type="text"
                  placeholder="e.g. S/N: 489-ADX99-231"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Default Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">Select location...</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Acquisition Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Acquisition Date</label>
                <input
                  type="date"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* Acquisition Cost */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Acquisition Cost (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1499.00 (Purely for dashboard tracking, no accounting linkage)"
                  value={acquisitionCost}
                  onChange={(e) => setAcquisitionCost(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* Condition */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Current Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Obsolete">Obsolete</option>
                </select>
              </div>

              {/* Next Maintenance Due */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Next Maintenance Due Date</label>
                <input
                  type="date"
                  value={nextMaintenance}
                  onChange={(e) => setNextMaintenance(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>
            </div>

            {/* Bookable Shared Resource Flag */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white block">Mark as Bookable Shared Resource</span>
                <span className="text-xs text-slate-500 mt-0.5">Allows employees to schedule bookings for this asset (e.g. conference room TV).</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBookable}
                  onChange={(e) => setIsBookable(e.target.checked)}
                  className="sr-only peer cursor-pointer"
                />
                <div className="w-11 h-6 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 peer-checked:after:bg-white"></div>
              </label>
            </div>

            {/* DYNAMIC CATEGORY FIELDS */}
            {categoryId && categoryFieldsSchema.length > 0 && (
              <div className="border-t border-slate-800/80 pt-4 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Category Specification Details ({selectedCategoryObj?.name})</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryFieldsSchema.map((field: any) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-350 block">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      
                      {field.type === 'string' && (
                        <input
                          type="text"
                          required={field.required}
                          value={customFields[field.key] || ''}
                          onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-primary-500 rounded-xl text-white text-xs outline-none transition"
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          type="number"
                          required={field.required}
                          value={customFields[field.key] || ''}
                          onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-primary-500 rounded-xl text-white text-xs outline-none transition"
                        />
                      )}

                      {field.type === 'boolean' && (
                        <select
                          required={field.required}
                          value={customFields[field.key]?.toString() || 'false'}
                          onChange={(e) => handleCustomFieldChange(field.key, e.target.value === 'true')}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-primary-500 rounded-xl text-white text-xs outline-none transition"
                        >
                          <option value="false">No / False</option>
                          <option value="true">Yes / True</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo upload attachment */}
            <div className="border-t border-slate-800/80 pt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Photo / Document Attachment</label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose File</span>
                </button>
                <span className="text-xs text-slate-500">
                  {selectedFile ? selectedFile.name : 'No file selected (Max 5MB)'}
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  accept="image/*,application/pdf"
                />
              </div>
            </div>

            {/* Action buttons */}
            <button
              type="submit"
              disabled={createAssetMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
            >
              {createAssetMutation.isPending ? 'Registering...' : 'Register and Save Asset'}
            </button>
          </form>
        </div>
      )}

      {/* 3. ASSET DETAIL & HISTORY LOGS VIEW */}
      {viewMode === 'detail' && (
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setViewMode('list');
                  setSelectedAssetId(null);
                }}
                className="px-3 py-1.5 bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Back to Directory
              </button>
              <h3 className="text-lg font-bold text-white">Asset Details</h3>
            </div>
            {assetDetail && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                statusColors[assetDetail.status]
              }`}>
                {assetDetail.status.replace('_', ' ')}
              </span>
            )}
          </div>

          {detailLoading || !assetDetail ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Fetching asset card details...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Metadata Specifications */}
              <div className="lg:col-span-2 space-y-6">
                <div className="glass rounded-2xl p-6 border border-slate-800/80 space-y-6 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-2xl font-extrabold text-white tracking-tight">{assetDetail.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs px-2.5 py-1 bg-slate-850 text-slate-350 rounded-lg border border-slate-800">
                          Tag: <span className="font-semibold text-white">{assetDetail.assetTag}</span>
                        </span>
                        <span className="text-xs px-2.5 py-1 bg-slate-850 text-slate-350 rounded-lg border border-slate-800">
                          Cat: <span className="font-semibold text-white">{assetDetail.category.name}</span>
                        </span>
                        {assetDetail.isBookable && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Bookable Shared Resource
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Photo Attachment if present */}
                  {assetDetail.attachments && assetDetail.attachments.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 max-h-64 flex justify-center items-center">
                      <img
                        src={assetDetail.attachments[assetDetail.attachments.length - 1].fileUrl}
                        alt="Asset preview"
                        className="object-contain max-h-64"
                      />
                    </div>
                  )}

                  {/* Tech Specs Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-slate-800/60 pt-4">
                    <div>
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Serial Number</span>
                      <p className="text-slate-200 mt-0.5">{assetDetail.serialNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Current Location</span>
                      <p className="text-slate-200 mt-0.5">
                        {assetDetail.location ? assetDetail.location.name : 'Office Stockroom (HQ)'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Acquisition Date</span>
                      <p className="text-slate-200 mt-0.5">
                        {assetDetail.acquisitionDate ? new Date(assetDetail.acquisitionDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Acquisition Cost</span>
                      <p className="text-slate-200 mt-0.5">
                        {assetDetail.acquisitionCost ? `$${Number(assetDetail.acquisitionCost).toLocaleString()}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Condition</span>
                      <p className="text-slate-200 mt-0.5">{assetDetail.condition}</p>
                    </div>
                    <div>
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Next SLA Maintenance</span>
                      <p className="text-slate-200 mt-0.5">
                        {assetDetail.nextMaintenanceDueDate ? new Date(assetDetail.nextMaintenanceDueDate).toLocaleDateString() : 'None scheduled'}
                      </p>
                    </div>
                  </div>

                  {/* CUSTOM SPECIFICATIONS */}
                  {assetDetail.customFieldValues && Object.keys(assetDetail.customFieldValues).length > 0 && (
                    <div className="border-t border-slate-800/60 pt-4 space-y-3">
                      <span className="text-slate-550 text-xs uppercase font-bold tracking-wide">Category Specifications</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 text-sm">
                        {Object.entries(assetDetail.customFieldValues).map(([key, val]: any) => (
                          <div key={key}>
                            <span className="text-slate-450 text-xs font-semibold capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <p className="text-white mt-0.5">{val === true ? 'Yes' : val === false ? 'No' : val?.toString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* History tabs (Allocations & Maintenance) */}
                <div className="glass rounded-2xl border border-slate-800/80 overflow-hidden">
                  <div className="flex border-b border-slate-800 bg-slate-900/60">
                    <button
                      onClick={() => setDetailTab('info')}
                      className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition outline-none ${
                        detailTab === 'info'
                          ? 'border-primary-500 text-primary-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                      <span>Holder Info</span>
                    </button>
                    <button
                      onClick={() => setDetailTab('allocations')}
                      className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition outline-none ${
                        detailTab === 'allocations'
                          ? 'border-primary-500 text-primary-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>Allocation Logs ({assetDetail.allocations?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => setDetailTab('maintenance')}
                      className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition outline-none ${
                        detailTab === 'maintenance'
                          ? 'border-primary-500 text-primary-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Maintenance history ({assetDetail.maintenanceRequests?.length || 0})</span>
                    </button>
                  </div>

                  <div className="p-5">
                    {/* HOLDER INFO */}
                    {detailTab === 'info' && (
                      <div className="space-y-4">
                        <span className="text-slate-550 text-xs uppercase font-bold tracking-wide block">Current Holder</span>
                        {assetDetail.status === 'ALLOCATED' && assetDetail.allocations && assetDetail.allocations.some(a => a.status === 'ACTIVE') ? (
                          (() => {
                            const activeAllocation = assetDetail.allocations.find(a => a.status === 'ACTIVE');
                            return (
                              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Allocated To</span>
                                  {activeAllocation.employee ? (
                                    <p className="text-white font-bold text-base mt-0.5">{activeAllocation.employee.name} (Employee)</p>
                                  ) : (
                                    <p className="text-white font-bold text-base mt-0.5">{activeAllocation.department?.name} (Department)</p>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-800/80 pt-3 text-slate-400">
                                  <div>
                                    <span>Assigned On:</span>
                                    <p className="text-slate-200 font-semibold mt-0.5">{new Date(activeAllocation.allocatedDate).toLocaleDateString()}</p>
                                  </div>
                                  <div>
                                    <span>Expected Return:</span>
                                    <p className="text-slate-200 font-semibold mt-0.5">
                                      {activeAllocation.expectedReturnDate ? new Date(activeAllocation.expectedReturnDate).toLocaleDateString() : 'Indefinite Check'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-sm rounded-xl">
                            Asset is currently sitting in inventory. No active allocations.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ALLOCATION LOGS */}
                    {detailTab === 'allocations' && (
                      <div className="space-y-4">
                        {(!assetDetail.allocations || assetDetail.allocations.length === 0) ? (
                          <p className="text-slate-500 text-xs italic">No allocation history recorded for this asset.</p>
                        ) : (
                          <div className="space-y-3">
                            {assetDetail.allocations.map((a: any) => (
                              <div key={a.id} className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-semibold text-slate-200">
                                      {a.employee ? `Employee: ${a.employee.name}` : `Dept: ${a.department?.name}`}
                                    </span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                      a.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-slate-700/30 text-slate-400 border border-slate-700/20'
                                    }`}>
                                      {a.status}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(a.allocatedDate).toLocaleDateString()}
                                    {a.actualReturnDate && ` — Returned: ${new Date(a.actualReturnDate).toLocaleDateString()}`}
                                  </p>
                                </div>
                                {a.returnNotes && (
                                  <div className="text-xs bg-slate-950 p-2 rounded-lg border border-slate-850 max-w-xs">
                                    <span className="text-[9px] uppercase font-bold text-slate-500">Notes</span>
                                    <p className="text-slate-400 mt-0.5">{a.returnNotes}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* MAINTENANCE REQUESTS */}
                    {detailTab === 'maintenance' && (
                      <div className="space-y-4">
                        {(!assetDetail.maintenanceRequests || assetDetail.maintenanceRequests.length === 0) ? (
                          <p className="text-slate-500 text-xs italic">No maintenance requests logged for this asset.</p>
                        ) : (
                          <div className="space-y-3">
                            {assetDetail.maintenanceRequests.map((m: any) => (
                              <div key={m.id} className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-xs font-semibold text-white block">{m.issueDescription}</span>
                                    <span className="text-[10px] text-slate-500">
                                      Raised by {m.raisedBy.name} on {new Date(m.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-850 rounded border border-slate-750 text-slate-400">
                                    {m.status}
                                  </span>
                                </div>
                                {m.resolutionNotes && (
                                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-xs">
                                    <span className="text-[9px] uppercase font-bold text-primary-400">Resolution Details</span>
                                    <p className="text-slate-350 mt-0.5">{m.resolutionNotes}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: QR Asset Tag details */}
              <div className="space-y-6">
                <div className="glass rounded-2xl p-6 border border-slate-800/80 text-center space-y-6">
                  <div>
                    <h5 className="font-bold text-white text-base">Asset Tracking Tag</h5>
                    <p className="text-slate-400 text-xs mt-1">Tag value can be scanned to resolve inventory location and holder records.</p>
                  </div>

                  {qrUrl ? (
                    <div className="p-4 bg-white rounded-2xl inline-block border border-slate-200">
                      <img src={qrUrl} alt="Asset QR Code" className="mx-auto w-40 h-40" />
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-slate-900 border border-slate-800/60 flex items-center justify-center rounded-2xl mx-auto">
                      <QrCode className="w-12 h-12 text-slate-650" />
                    </div>
                  )}

                  <div className="text-center font-mono text-lg font-bold text-white tracking-widest bg-slate-950 py-2.5 rounded-xl border border-slate-850">
                    {assetDetail.assetTag}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AssetDirectory;
