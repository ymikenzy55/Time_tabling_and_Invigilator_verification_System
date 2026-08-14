import { z } from 'zod';
import { Building2 } from 'lucide-react';
import { EntityPage } from '@/components/EntityPage';
import { facultiesApi } from '@/features/academics/facultiesApi';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  code: z.string().trim().min(2, 'Code is required.'),
});

const updateSchema = createSchema.partial();

const FacultyFormFields = ({ register, errors }) => (
  <>
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

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: '_count', label: 'Departments', render: (v) => v?.departments ?? 0 },
];

export const FacultiesPage = () => (
  <EntityPage
    title="Faculties"
    description="Organize your university into faculties."
    queryKey="faculties"
    api={facultiesApi}
    columns={columns}
    FormFields={FacultyFormFields}
    createSchema={createSchema}
    updateSchema={updateSchema}
    createDefaultValues={{ name: '', code: '' }}
    searchPlaceholder="Search faculties..."
    emptyTitle="No faculties yet"
    emptyDescription="Create a faculty to start building your academic structure."
  />
);
