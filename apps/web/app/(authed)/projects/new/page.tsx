import { Card, CardTitle } from '@/components/ui/card';
import { CreateProjectForm } from './form';

export default function NewProjectPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-6">New project</h1>
      <Card>
        <CardTitle>Project details</CardTitle>
        <CreateProjectForm />
      </Card>
    </div>
  );
}
