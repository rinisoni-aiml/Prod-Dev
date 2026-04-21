import { Users } from 'lucide-react';
import SectionPage from '@/industries/education/components/SectionPage';

export default function AdmissionsRevenuePage() {
  return (
    <SectionPage
      section="admissions"
      title="Admissions & Revenue"
      description="Student admissions, fees collection and revenue analytics"
      icon={Users}
    />
  );
}