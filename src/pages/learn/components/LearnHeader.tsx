import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft } from "lucide-react";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function LearnHeader({
  courseId,
  courseTitle,
  lessonTitle,
  translate,
}: {
  courseId: string;
  courseTitle: string;
  lessonTitle: string | null;
  translate: TranslateFn;
}) {
  return (
    <>
      <Link
        to={`/courses/${courseId}`}
        className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground sm:hidden"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        {translate("detail.learn.backToCourse")}
      </Link>

      <Breadcrumb className="mb-4 hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/courses">{translate("catalog.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to={`/courses/${courseId}`}>{courseTitle}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {lessonTitle ?? translate("detail.learn.breadcrumbLearn")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
