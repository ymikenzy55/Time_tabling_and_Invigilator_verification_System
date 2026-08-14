import { z } from 'zod';
import { EntityPage } from '@/components/EntityPage';
import { academicYearsApi } from '@/features/academics/academicYearsApi';
import { Badge } from '@/components/ui/Badge';

const academicYearBaseSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  isActive: z.coerce.boolean().optional(),
});

const createSchema = academicYearBaseSchema.refine((v) => new Date(v.endDate) > new Date(v.startDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const updateSchema = academicYearBaseSchema.partial().refine((v) => !v.startDate || !v.endDate || new Date(v.endDate) > new Date(v.startDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const formatDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? v : d.toISOString().split('T')[0];
};

const AcademicYearFormFields = ({ register, errors }) => (
  <>
    <div>
      <label className="label">Name</label>
      <input className="input" placeholder="e.g. 2025/2026" {...register('name')} />
      {errors.name && <p className="field-error">{errors.name.message}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Start date</label>
        <input className="input" type="date" {...register('startDate')} />
        {errors.startDate && <p className="field-error">{errors.startDate.message}</p>}
      </div>
      <div>
        <label className="label">End date</label>
        <input className="input" type="date" {...register('endDate')} />
        {errors.endDate && <p className="field-error">{errors.endDate.message}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <input id="isActive" type="checkbox" {...register('isActive')} />
      <label htmlFor="isActive" className="text-sm text-ink-700">Set as active academic year</label>
    </div>
  </>
);

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'startDate', label: 'Start', render: (v) => formatDate(v) },
  { key: 'endDate', label: 'End', render: (v) => formatDate(v) },
  { key: 'isActive', label: 'Active', render: (v) => v ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge> },
  { key: '_count', label: 'Semesters', render: (v) => v?.semesters ?? 0 },
];

export const AcademicYearsPage = () => (
  <EntityPage
    title="Academic Years"
    description="Define academic sessions and set the active year."
    queryKey="academicYears"
    api={academicYearsApi}
    columns={columns}
    FormFields={AcademicYearFormFields}
    createSchema={createSchema}
    updateSchema={updateSchema}
    createDefaultValues={{ name: '', startDate: '', endDate: '', isActive: false }}
    searchPlaceholder="Search academic years..."
    emptyTitle="No academic years yet"
    emptyDescription="Create an academic year to host semesters."
  />
);
