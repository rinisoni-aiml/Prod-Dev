import { BookOpen } from 'lucide-react';
import SectionPage from '@/industries/education/components/SectionPage';

export default function AcademicIntelligencePage() {
  return (
    <SectionPage
      section="academic"
      title="Academic Intelligence"
      description="Student marks, grades, attendance and subject performance analytics"
      icon={BookOpen}
    />
  );
}