import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { EntityPage } from '@/components/EntityPage';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { facultiesApi } from '@/features/academics/facultiesApi';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  code: z.string().trim().min(2, 'Code is required.'),
  facultyId: z.string().min(1, 'Faculty is required.'),
});

const updateSchema = createSchema.partial();

const DepartmentFormFields = ({ register, errors }) => {
  const { data: faculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => facultiesApi.list(),
  });

  return (
    <>
      <div>
        <label className="label">Faculty</label>
        <select className="input" {...register('facultyId')}>
          <option value="">Select a faculty</option>
          {faculties.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {errors.facultyId && <p className="field-error">{errors.facultyId.message}</p>}
      </div>
      <div>
        <label className="label">Name</label>
        <input className="input" {...register('name')} />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>
      <div>
        <label className="label">Code</label>
        <input className="input" {...register('code')} />
        {errors.code && <p className="field-error">{errors.code.message}</p>}
      </div>
    </>
  );
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: 'faculty', label: 'Faculty', render: (v) => v?.name || '—' },
  { key: '_count', label: 'Users / Courses', render: (v) => `${v?.users ?? 0} / ${v?.courses ?? 0}` },
];

export const DepartmentsPage = () => (
  <EntityPage
    title="Departments"
    description="Departments belong to a faculty."
    queryKey="departments"
    api={departmentsApi}
    columns={columns}
    FormFields={DepartmentFormFields}
    createSchema={createSchema}
    updateSchema={updateSchema}
    createDefaultValues={{ name: '', code: '', facultyId: '' }}
    searchPlaceholder="Search departments..."
    emptyTitle="No departments yet"
    emptyDescription="Add departments to group courses and staff."
  />
);
