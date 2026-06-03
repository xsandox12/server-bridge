import { NextResponse } from "next/server";
import { readProjects, writeProjects } from "@/lib/planning/fileSystem";
import type { PlanProject, Category } from "@/lib/planning/types";
import { nanoid } from "nanoid";

export async function GET() {
  const data = readProjects();
  return NextResponse.json(data.projects);
}

export async function POST(req: Request) {
  const body = await req.json();
  const data = readProjects();

  if (body.type === "project") {
    const project: PlanProject = {
      id: nanoid(),
      name: body.name,
      createdAt: new Date().toISOString(),
      categories: [],
    };
    data.projects.push(project);
    writeProjects(data);
    return NextResponse.json(project);
  }

  if (body.type === "category") {
    const project = data.projects.find((p) => p.id === body.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const category: Category = { id: nanoid(), name: body.name, documents: [] };
    project.categories.push(category);
    writeProjects(data);
    return NextResponse.json(category);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
