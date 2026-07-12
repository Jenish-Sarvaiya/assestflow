import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Employee } from '../store/auth';
import { Plus, Edit2, ShieldAlert, ArrowUpRight, Save, X, Building2, Users, Layers, Check, RefreshCw, PlusCircle, Trash2 } from 'lucide-react';

interface Department {
  id: number;
  name: string;
  parentDepartmentId: number | null;
  departmentHeadId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  departmentHead?: { id: number; name: string; email: string } | null;
  parentDepartment?: { id: number; name: string } | null;
}

interface CustomFieldSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
}

interface AssetCategory {
  id: number;
  name: string;
  description: string | null;
  customFieldsSchema: CustomFieldSchema[] | null;
}

export const OrgSetup: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'employees'>('departments');

  // Modals & Editing States
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [parentDeptId, setParentDeptId] = useState<string>('');
  const [deptHeadId, setDeptHeadId] = useState<string>('');
  const [deptStatus, setDeptStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AssetCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catFields, setCatFields] = useState<CustomFieldSchema[]>([]);

  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empDeptId, setEmpDeptId] = useState<string>('');
  const [empStatus, setEmpStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [empRole, setEmpRole] = useState<'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE'>('EMPLOYEE');

  // Queries
  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<AssetCategory[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const { data: employees = [], isLoading: empsLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees'),
  });

  // Mutations
  const saveDeptMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingDept) {
        return api.patch(`/departments/${editingDept.id}`, data);
      }
      return api.post('/departments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeptModalOpen(false);
      setEditingDept(null);
      setDeptName('');
      setParentDeptId('');
      setDeptHeadId('');
    },
  });

  const saveCatMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingCat) {
        return api.patch(`/categories/${editingCat.id}`, data);
      }
      return api.post('/categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCatModalOpen(false);
      setEditingCat(null);
      setCatName('');
      setCatDesc('');
      setCatFields([]);
    },
  });

  const saveEmpMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      return api.patch(`/employees/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEmpModalOpen(false);
      setEditingEmp(null);
    },
  });

  const promoteEmpMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => {
      return api.patch(`/employees/${id}/promote`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEmpModalOpen(false);
      setEditingEmp(null);
    },
  });

  // Department handlers
  const openAddDept = () => {
    setEditingDept(null);
    setDeptName('');
    setParentDeptId('');
    setDeptHeadId('');
    setDeptStatus('ACTIVE');
    setDeptModalOpen(true);
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setParentDeptId(dept.parentDepartmentId?.toString() || '');
    setDeptHeadId(dept.departmentHeadId?.toString() || '');
    setDeptStatus(dept.status);
    setDeptModalOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: deptName,
      parentDepartmentId: parentDeptId ? parseInt(parentDeptId) : null,
      departmentHeadId: deptHeadId ? parseInt(deptHeadId) : null,
      status: deptStatus,
    };
    saveDeptMutation.mutate(payload);
  };

  // Category schema builder handlers
  const openAddCat = () => {
    setEditingCat(null);
    setCatName('');
    setCatDesc('');
    setCatFields([]);
    setCatModalOpen(true);
  };

  const openEditCat = (cat: AssetCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatFields(cat.customFieldsSchema || []);
    setCatModalOpen(true);
  };

  const addSchemaField = () => {
    setCatFields([...catFields, { key: '', label: '', type: 'string', required: false }]);
  };

  const updateSchemaField = (index: number, key: keyof CustomFieldSchema, value: any) => {
    const updated = [...catFields];
    updated[index] = { ...updated[index], [key]: value };
    setCatFields(updated);
  };

  const removeSchemaField = (index: number) => {
    setCatFields(catFields.filter((_, i) => i !== index));
  };

  const handleSaveCat = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: catName,
      description: catDesc,
      customFieldsSchema: catFields.length > 0 ? catFields : null,
    };
    saveCatMutation.mutate(payload);
  };

  // Employee action handlers
  const openEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpDeptId(emp.departmentId?.toString() || '');
    setEmpStatus(emp.status);
    setEmpRole(emp.role);
    setEmpModalOpen(true);
  };

  const handleSaveEmpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    // Apply department / status update
    saveEmpMutation.mutate({
      id: editingEmp.id,
      data: {
        departmentId: empDeptId ? parseInt(empDeptId) : null,
        status: empStatus,
      },
    });

    // Apply role update if it has changed
    if (empRole !== editingEmp.role) {
      promoteEmpMutation.mutate({
        id: editingEmp.id,
        role: empRole,
      });
    }
  };

  return (
    <div className="space-y-6 text-white selection:bg-primary-500 selection:text-white">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Organization Settings</h2>
          <p className="text-slate-400 text-sm mt-1">Configure departments hierarchy, custom asset properties, and employee directory settings.</p>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold tracking-wide transition outline-none ${
            activeTab === 'departments'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold tracking-wide transition outline-none ${
            activeTab === 'categories'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Asset Categories</span>
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold tracking-wide transition outline-none ${
            activeTab === 'employees'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Employee Directory</span>
        </button>
      </div>

      {/* Loading Banner */}
      {(deptsLoading || catsLoading || empsLoading) && (
        <div className="flex items-center justify-center space-x-3 py-12 text-slate-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
          <span>Loading organization configuration details...</span>
        </div>
      )}

      {/* Tab Panels */}
      {!deptsLoading && !catsLoading && !empsLoading && (
        <div>
          {/* TAB A: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-200">Department Hierarchy</h3>
                <button
                  onClick={openAddDept}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Department</span>
                </button>
              </div>

              {departments.length === 0 ? (
                <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
                  No departments found. Click Add Department to create the first organization structure.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div key={dept.id} className="glass rounded-2xl p-5 space-y-4 relative group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-base text-white">{dept.name}</h4>
                          {dept.parentDepartment && (
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Sub-department of <span className="text-slate-400">{dept.parentDepartment.name}</span>
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          dept.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {dept.status}
                        </span>
                      </div>

                      <div className="border-t border-slate-800/80 pt-3 flex flex-col space-y-1.5 text-xs text-slate-400">
                        <div className="flex justify-between">
                          <span>Department Head:</span>
                          <span className="font-semibold text-slate-200">
                            {dept.departmentHead ? dept.departmentHead.name : 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openEditDept(dept)}
                        className="absolute bottom-4 right-4 p-2 bg-slate-800 group-hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition outline-none cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB B: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-200">Asset Categories</h3>
                <button
                  onClick={openAddCat}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
                  No asset categories found. Click Add Category to define equipment properties.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categories.map((cat) => (
                    <div key={cat.id} className="glass rounded-2xl p-6 space-y-4 relative group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg text-white">{cat.name}</h4>
                          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{cat.description || 'No description provided.'}</p>
                        </div>
                        <button
                          onClick={() => openEditCat(cat)}
                          className="p-2 bg-slate-800 group-hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition outline-none cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="border-t border-slate-800/80 pt-4 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Custom Specification Schema</span>
                        {cat.customFieldsSchema && cat.customFieldsSchema.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {cat.customFieldsSchema.map((field) => (
                              <span key={field.key} className="text-xs px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-800 text-slate-300">
                                {field.label} ({field.type}){field.required ? '*' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-xs italic">No category-specific fields. Uses base tags only.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB C: EMPLOYEE DIRECTORY */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-200">System Employee & Access Management</h3>
              
              <div className="glass rounded-2xl overflow-hidden border border-slate-800/60">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{emp.name}</td>
                        <td className="px-6 py-4 text-slate-400">{emp.email}</td>
                        <td className="px-6 py-4">
                          {emp.department ? emp.department.name : <span className="text-slate-500 italic">None</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-full">
                            {emp.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openEditEmp(emp)}
                            className="text-xs font-semibold px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-primary-400 hover:text-primary-300 border border-slate-800 hover:border-slate-700 rounded-lg transition outline-none cursor-pointer inline-flex items-center space-x-1"
                          >
                            <span>Manage</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingDept ? 'Edit Department Settings' : 'Create Department'}
              </h3>
              <button onClick={() => setDeptModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance & Accounting"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Parent Department</label>
                <select
                  value={parentDeptId}
                  onChange={(e) => setParentDeptId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">No parent (Top-level)</option>
                  {departments
                    .filter((d) => !editingDept || d.id !== editingDept.id) // Filter self
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Department Head</label>
                <select
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">No head assigned</option>
                  {employees
                    .filter((e) => e.role === 'DEPARTMENT_HEAD' || e.role === 'ADMIN')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.email})
                      </option>
                    ))}
                </select>
              </div>

              {editingDept && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">Status</label>
                  <select
                    value={deptStatus}
                    onChange={(e) => setDeptStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={saveDeptMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {saveDeptMutation.isPending ? 'Saving...' : 'Save Department'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingCat ? 'Edit Category Settings' : 'Create Asset Category'}
              </h3>
              <button onClick={() => setCatModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electronics, Furniture"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Description</label>
                <textarea
                  placeholder="Brief description of the category assets..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* SCHEMA FIELDS BUILDER */}
              <div className="border-t border-slate-800/80 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Custom Category Fields Schema</span>
                  <button
                    type="button"
                    onClick={addSchemaField}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-primary-400 hover:text-primary-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition outline-none cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Attribute</span>
                  </button>
                </div>

                {catFields.length === 0 ? (
                  <p className="text-slate-500 text-xs italic">No custom fields defined. Category assets will use only default specifications.</p>
                ) : (
                  <div className="space-y-3">
                    {catFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 relative group">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              placeholder="Field key (e.g. warranty)"
                              value={field.key}
                              onChange={(e) => updateSchemaField(idx, 'key', e.target.value)}
                              className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:border-primary-500 outline-none placeholder:text-slate-650"
                            />
                            <input
                              type="text"
                              required
                              placeholder="Label (e.g. Warranty Months)"
                              value={field.label}
                              onChange={(e) => updateSchemaField(idx, 'label', e.target.value)}
                              className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:border-primary-500 outline-none placeholder:text-slate-650"
                            />
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-slate-400">Type:</span>
                              <select
                                value={field.type}
                                onChange={(e) => updateSchemaField(idx, 'type', e.target.value as any)}
                                className="bg-slate-950 border border-slate-800 text-white text-xs px-2 py-0.5 rounded outline-none"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                              </select>
                            </div>
                            <label className="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateSchemaField(idx, 'required', e.target.checked)}
                                className="rounded bg-slate-950 border-slate-800 text-primary-500 focus:ring-0 cursor-pointer"
                              />
                              <span>Required</span>
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSchemaField(idx)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/20 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saveCatMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {saveCatMutation.isPending ? 'Saving...' : 'Save Category'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EMPLOYEE ACCESS & PROMOTIONS MODAL */}
      {empModalOpen && editingEmp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Manage Access: {editingEmp.name}</h3>
              <button onClick={() => setEmpModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmpSettings} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Department Transfer</label>
                <select
                  value={empDeptId}
                  onChange={(e) => setEmpDeptId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">No Department Assignee</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">System Access Role</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="EMPLOYEE">EMPLOYEE (Standard Access)</option>
                  <option value="ASSET_MANAGER">ASSET MANAGER (Inventory Control)</option>
                  <option value="DEPARTMENT_HEAD">DEPARTMENT HEAD (Approvals & Budgets)</option>
                  <option value="ADMIN">ADMIN (System Owner)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Account Status</label>
                <select
                  value={empStatus}
                  onChange={(e) => setEmpStatus(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="ACTIVE">ACTIVE (Granted Login access)</option>
                  <option value="INACTIVE">DEACTIVATED (Revoked system logins)</option>
                </select>
              </div>

              <div className="p-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-xl text-[11px] leading-relaxed flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Role promotions will alter security access filters instantly across allocations, booking, audits, and department-level approvals in real-time.
                </span>
              </div>

              <button
                type="submit"
                disabled={saveEmpMutation.isPending || promoteEmpMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {saveEmpMutation.isPending || promoteEmpMutation.isPending ? 'Updating...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default OrgSetup;
