import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { EntityPage } from '@/components/EntityPage';
import { semestersApi } from '@/features/academics/semestersApi';
import { academicYearsApi } from '@/features/academics/academicYearsApi';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';

const semesterBaseSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  academicYearId: z.string().min(1, 'Academic year is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  isActive: z.coerce.boolean().optional(),
});

const createSchema = semesterBaseSchema.refine((v) => new Date(v.endDate) > new Date(v.startDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const updateSchema = semesterBaseSchema.partial().refine((v) => !v.startDate || !v.endDate || new Date(v.endDate) > new Date(v.startDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const formatDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? v : d.toISOString().split('T')[0];
};

const SemesterFormFields = ({ register, errors }) => {
  const { data: years = [] } = useQuery({
    queryKey: ['academicYears'],
    queryFn: () => academicYearsApi.list(),
    staleTime: 5 * 60_000,
  });

  return (
    <>
      <div>
        <label className="label">Academic year</label>
        <select className="input" {...register('academicYearId')}>
          <option value="">Select an academic year</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
        {errors.academicYearId && <p className="field-error">{errors.academicYearId.message}</p>}
      </div>
      <div>
        <label className="label">Name</label>
        <input className="input" placeholder="e.g. First Semester" {...register('name')} />
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
        <input id="sem-isActive" type="checkbox" {...register('isActive')} />
        <label htmlFor="sem-isActive" className="text-sm text-ink-700">Set as active semester</label>
      </div>
    </>
  );
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'academicYear', label: 'Academic Year', render: (v) => v?.name || '—' },
  { key: 'startDate', label: 'Start', render: (v) => formatDate(v) },
  { key: 'endDate', label: 'End', render: (v) => formatDate(v) },
  { key: 'isActive', label: 'Active', render: (v) => v ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge> },
  { key: '_count', label: 'Courses', render: (v) => v?.courses ?? 0 },
];

export const SemestersPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <EntityPage
      title="Semesters"
      description="Semesters belong to an academic year."
      queryKey="semesters"
      api={semestersApi}
      columns={columns}
      FormFields={SemesterFormFields}
      createSchema={createSchema}
      updateSchema={updateSchema}
      createDefaultValues={{ name: '', academicYearId: '', startDate: '', endDate: '', isActive: false }}
      searchPlaceholder="Search semesters..."
      emptyTitle="No semesters yet"
      emptyDescription="Create a semester to host courses."
      canEdit={isSuperAdmin}
      canDelete={isSuperAdmin}
      canCreate={isSuperAdmin}
    />
  );
};
