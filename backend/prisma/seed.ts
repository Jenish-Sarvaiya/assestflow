import { PrismaClient, Role, ActiveStatus, AssetStatus, AllocationStatus, BookingStatus, MaintenancePriority, MaintenanceStatus, AuditCycleStatus, AuditItemResult } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing database records (order matters to avoid constraint errors)
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditItem.deleteMany();
  await prisma.auditCycleAuditor.deleteMany();
  await prisma.auditCycle.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.resourceBooking.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.assetAllocation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.location.deleteMany();
  await prisma.assetCategory.deleteMany();
  
  // Set heads of departments to null to safely delete employees
  await prisma.department.updateMany({ data: { departmentHeadId: null } });
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  // 2. Hash standard passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const managerPasswordHash = await bcrypt.hash('manager123', 10);
  const headPasswordHash = await bcrypt.hash('head123', 10);
  const employeePasswordHash = await bcrypt.hash('employee123', 10);

  // 3. Create bootstrap Admin
  const admin = await prisma.employee.create({
    data: {
      name: 'System Admin',
      email: 'admin@assetflow.local',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: ActiveStatus.ACTIVE,
    },
  });

  console.log('Bootstrap Admin created: admin@assetflow.local / admin123');

  // 4. Create Departments
  const executive = await prisma.department.create({
    data: { name: 'Executive Board', status: ActiveStatus.ACTIVE },
  });

  const engineering = await prisma.department.create({
    data: {
      name: 'Engineering',
      status: ActiveStatus.ACTIVE,
    },
  });

  const softwareDev = await prisma.department.create({
    data: {
      name: 'Software Development',
      parentDepartmentId: engineering.id,
      status: ActiveStatus.ACTIVE,
    },
  });

  const operations = await prisma.department.create({
    data: { name: 'Operations', status: ActiveStatus.ACTIVE },
  });

  // 5. Create Employees across various roles
  const manager1 = await prisma.employee.create({
    data: {
      name: 'Sarah Connor',
      email: 'sarah.connor@assetflow.local',
      passwordHash: managerPasswordHash,
      role: Role.ASSET_MANAGER,
      status: ActiveStatus.ACTIVE,
    },
  });

  const manager2 = await prisma.employee.create({
    data: {
      name: 'John Connor',
      email: 'john.connor@assetflow.local',
      passwordHash: managerPasswordHash,
      role: Role.ASSET_MANAGER,
      status: ActiveStatus.ACTIVE,
    },
  });

  const headEng = await prisma.employee.create({
    data: {
      name: 'Miles Dyson',
      email: 'miles.dyson@assetflow.local',
      passwordHash: headPasswordHash,
      role: Role.DEPARTMENT_HEAD,
      departmentId: engineering.id,
      status: ActiveStatus.ACTIVE,
    },
  });

  const headOps = await prisma.employee.create({
    data: {
      name: 'Marcus Wright',
      email: 'marcus.wright@assetflow.local',
      passwordHash: headPasswordHash,
      role: Role.DEPARTMENT_HEAD,
      departmentId: operations.id,
      status: ActiveStatus.ACTIVE,
    },
  });

  // Assign department heads
  await prisma.department.update({
    where: { id: engineering.id },
    data: { departmentHeadId: headEng.id },
  });

  await prisma.department.update({
    where: { id: operations.id },
    data: { departmentHeadId: headOps.id },
  });

  const dev1 = await prisma.employee.create({
    data: {
      name: 'Priya Sharma',
      email: 'priya.sharma@assetflow.local',
      passwordHash: employeePasswordHash,
      role: Role.EMPLOYEE,
      departmentId: softwareDev.id,
      status: ActiveStatus.ACTIVE,
    },
  });

  const dev2 = await prisma.employee.create({
    data: {
      name: 'Raj Patel',
      email: 'raj.patel@assetflow.local',
      passwordHash: employeePasswordHash,
      role: Role.EMPLOYEE,
      departmentId: softwareDev.id,
      status: ActiveStatus.ACTIVE,
    },
  });

  const opStaff1 = await prisma.employee.create({
    data: {
      name: 'T-800 Bob',
      email: 'bob.t800@assetflow.local',
      passwordHash: employeePasswordHash,
      role: Role.EMPLOYEE,
      departmentId: operations.id,
      status: ActiveStatus.ACTIVE,
    },
  });

  // 6. Create Asset Categories
  const categoryElectronics = await prisma.assetCategory.create({
    data: {
      name: 'Electronics',
      description: 'Laptops, servers, screens, and mobile phones',
      customFieldsSchema: [
        { key: 'warrantyMonths', label: 'Warranty (months)', type: 'number', required: false },
        { key: 'ram', label: 'RAM (GB)', type: 'number', required: false },
        { key: 'processor', label: 'Processor', type: 'string', required: false },
      ],
    },
  });

  const categoryFurniture = await prisma.assetCategory.create({
    data: {
      name: 'Furniture',
      description: 'Desks, chairs, filing cabinets',
      customFieldsSchema: [
        { key: 'material', label: 'Material', type: 'string', required: false },
        { key: 'adjustableHeight', label: 'Adjustable Height', type: 'boolean', required: false },
      ],
    },
  });

  const categoryVehicles = await prisma.assetCategory.create({
    data: {
      name: 'Vehicles',
      description: 'Company cars, cargo vans',
      customFieldsSchema: [
        { key: 'licensePlate', label: 'License Plate', type: 'string', required: true },
        { key: 'mileage', label: 'Current Mileage', type: 'number', required: false },
      ],
    },
  });

  const categoryOfficeSupplies = await prisma.assetCategory.create({
    data: {
      name: 'Office Supplies',
      description: 'Printers, whiteboards, presentation screens',
    },
  });

  // 7. Create Locations
  const locHq1 = await prisma.location.create({ data: { name: 'Main HQ - Floor 1' } });
  const locHq2 = await prisma.location.create({ data: { name: 'Main HQ - Floor 2' } });
  const locWarehouse = await prisma.location.create({ data: { name: 'Warehouse A' } });

  // 8. Create Assets in various states
  // Available assets
  const assetLaptop1 = await prisma.asset.create({
    data: {
      assetTag: 'AF-0001',
      name: 'MacBook Pro 16"',
      categoryId: categoryElectronics.id,
      serialNumber: 'MBP16-2026-X1',
      acquisitionDate: new Date('2026-01-15'),
      acquisitionCost: 2499.00,
      condition: 'Excellent',
      locationId: locHq1.id,
      status: AssetStatus.AVAILABLE,
      isBookable: false,
      qrCodeValue: 'AF-0001',
      customFieldValues: { warrantyMonths: 36, ram: 32, processor: 'M3 Max' },
      registeredById: manager1.id,
    },
  });

  const assetLaptop2 = await prisma.asset.create({
    data: {
      assetTag: 'AF-0002',
      name: 'ThinkPad T14',
      categoryId: categoryElectronics.id,
      serialNumber: 'TPT14-2026-Y4',
      acquisitionDate: new Date('2026-02-10'),
      acquisitionCost: 1200.00,
      condition: 'Good',
      locationId: locHq2.id,
      status: AssetStatus.AVAILABLE,
      isBookable: false,
      qrCodeValue: 'AF-0002',
      customFieldValues: { warrantyMonths: 24, ram: 16, processor: 'Intel i7' },
      registeredById: manager1.id,
    },
  });

  // Bookable Conference Room Screen (Reserved/Available)
  const assetScreen = await prisma.asset.create({
    data: {
      assetTag: 'AF-0003',
      name: 'Main Conference Room TV 85"',
      categoryId: categoryOfficeSupplies.id,
      serialNumber: 'TV85-SAMSUNG-9',
      acquisitionDate: new Date('2025-06-01'),
      acquisitionCost: 1800.00,
      condition: 'Excellent',
      locationId: locHq1.id,
      status: AssetStatus.AVAILABLE,
      isBookable: true,
      qrCodeValue: 'AF-0003',
      registeredById: manager1.id,
    },
  });

  // Allocated laptop to Priya
  const assetLaptop3 = await prisma.asset.create({
    data: {
      assetTag: 'AF-0004',
      name: 'Dell XPS 15',
      categoryId: categoryElectronics.id,
      serialNumber: 'XPS15-DELL-Z2',
      acquisitionDate: new Date('2025-10-05'),
      acquisitionCost: 1750.00,
      condition: 'Good',
      locationId: locHq2.id,
      status: AssetStatus.ALLOCATED,
      isBookable: false,
      qrCodeValue: 'AF-0004',
      customFieldValues: { warrantyMonths: 24, ram: 32, processor: 'Intel i9' },
      registeredById: manager2.id,
    },
  });

  // Create allocation for Priya
  const allocationPriya = await prisma.assetAllocation.create({
    data: {
      assetId: assetLaptop3.id,
      employeeId: dev1.id,
      allocatedDate: new Date('2026-05-01'),
      expectedReturnDate: new Date('2027-05-01'),
      status: AllocationStatus.ACTIVE,
      conditionAtAllocation: 'Good',
    },
  });

  // Overdue allocation to Raj
  const assetLaptop4 = await prisma.asset.create({
    data: {
      assetTag: 'AF-0005',
      name: 'HP EliteBook 840',
      categoryId: categoryElectronics.id,
      serialNumber: 'HP840-2025-W1',
      acquisitionDate: new Date('2025-01-10'),
      acquisitionCost: 1100.00,
      condition: 'Fair',
      locationId: locHq2.id,
      status: AssetStatus.ALLOCATED,
      isBookable: false,
      qrCodeValue: 'AF-0005',
      customFieldValues: { warrantyMonths: 12, ram: 16, processor: 'Ryzen 7' },
      registeredById: manager2.id,
    },
  });

  // Allocation in the past
  const allocationRaj = await prisma.assetAllocation.create({
    data: {
      assetId: assetLaptop4.id,
      employeeId: dev2.id,
      allocatedDate: new Date('2026-01-01'),
      expectedReturnDate: new Date('2026-06-30'), // Overdue relative to 2026-07-12
      status: AllocationStatus.ACTIVE,
      conditionAtAllocation: 'Fair',
    },
  });

  // Maintenance asset
  const assetProjector = await prisma.asset.create({
    data: {
      assetTag: 'AF-0006',
      name: 'Epson 4K Projector',
      categoryId: categoryOfficeSupplies.id,
      serialNumber: 'PROJ-EPS-4K',
      acquisitionDate: new Date('2024-03-20'),
      acquisitionCost: 950.00,
      condition: 'Poor',
      locationId: locHq1.id,
      status: AssetStatus.UNDER_MAINTENANCE,
      isBookable: false,
      qrCodeValue: 'AF-0006',
      registeredById: manager1.id,
    },
  });

  // Maintenance Request
  const maintProjector = await prisma.maintenanceRequest.create({
    data: {
      assetId: assetProjector.id,
      raisedById: dev2.id,
      issueDescription: 'Lamp is overheating and turning off after 5 minutes of usage.',
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.IN_PROGRESS,
      assignedTechnicianName: 'Bob Repairman',
    },
  });

  // Retired asset
  const assetOldServer = await prisma.asset.create({
    data: {
      assetTag: 'AF-0007',
      name: 'Dell PowerEdge R720',
      categoryId: categoryElectronics.id,
      serialNumber: 'SV-DELL-R720',
      acquisitionDate: new Date('2018-04-10'),
      acquisitionCost: 4500.00,
      condition: 'Obsolete',
      locationId: locWarehouse.id,
      status: AssetStatus.RETIRED,
      isBookable: false,
      qrCodeValue: 'AF-0007',
      customFieldValues: { warrantyMonths: 0, ram: 64, processor: 'Xeon E5' },
      registeredById: manager2.id,
    },
  });

  // Department-level allocation (Operations Department vehicle)
  const assetVan = await prisma.asset.create({
    data: {
      assetTag: 'AF-0008',
      name: 'Ford Transit Cargo Van',
      categoryId: categoryVehicles.id,
      serialNumber: 'FORD-TRANSIT-VAN1',
      acquisitionDate: new Date('2024-09-01'),
      acquisitionCost: 35000.00,
      condition: 'Good',
      locationId: locWarehouse.id,
      status: AssetStatus.ALLOCATED,
      isBookable: false,
      qrCodeValue: 'AF-0008',
      customFieldValues: { licensePlate: 'OP-VAN-99', mileage: 25000 },
      registeredById: manager1.id,
    },
  });

  await prisma.assetAllocation.create({
    data: {
      assetId: assetVan.id,
      departmentId: operations.id,
      allocatedDate: new Date('2024-09-10'),
      status: AllocationStatus.ACTIVE,
      conditionAtAllocation: 'Excellent',
    },
  });

  // Ergonomic chair
  const assetChair = await prisma.asset.create({
    data: {
      assetTag: 'AF-0009',
      name: 'Herman Miller Aeron Chair',
      categoryId: categoryFurniture.id,
      serialNumber: 'HM-AERON-C52',
      acquisitionDate: new Date('2025-01-20'),
      acquisitionCost: 1400.00,
      condition: 'Good',
      locationId: locHq1.id,
      status: AssetStatus.AVAILABLE,
      isBookable: false,
      qrCodeValue: 'AF-0009',
      customFieldValues: { material: 'Mesh', adjustableHeight: true },
      registeredById: manager1.id,
    },
  });

  // 9. Bookings for TV (imminent or current)
  // Ongoing Booking (e.g. 1 hour ago to 1 hour from now)
  const now = new Date();
  const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago
  const endTime = new Date(now.getTime() + 90 * 60 * 1000); // 1.5 hours from now
  
  await prisma.resourceBooking.create({
    data: {
      assetId: assetScreen.id,
      bookedById: dev1.id,
      departmentId: softwareDev.id,
      startTime: startTime,
      endTime: endTime,
      purpose: 'Sprint Planning & Demo Meeting',
      status: BookingStatus.UPCOMING,
    },
  });

  // 10. Audit Cycle (Planned/In Progress)
  const auditCycle = await prisma.auditCycle.create({
    data: {
      name: 'Q3 Hardware Audit',
      scopeDepartmentId: softwareDev.id,
      scopeLocationId: locHq2.id,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      status: AuditCycleStatus.IN_PROGRESS,
      createdById: admin.id,
    },
  });

  // Assign Head of Engineering as Auditor
  await prisma.auditCycleAuditor.create({
    data: {
      auditCycleId: auditCycle.id,
      employeeId: headEng.id,
    },
  });

  // Populate AuditItems for softwareDev assets on Floor 2 (e.g., Priya's and Raj's laptops)
  await prisma.auditItem.create({
    data: {
      auditCycleId: auditCycle.id,
      assetId: assetLaptop3.id, // Priya's laptop
      result: AuditItemResult.PENDING,
    },
  });

  await prisma.auditItem.create({
    data: {
      auditCycleId: auditCycle.id,
      assetId: assetLaptop4.id, // Raj's laptop
      result: AuditItemResult.PENDING,
    },
  });

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
