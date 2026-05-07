"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { Plus, RotateCcw, Sparkles, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { WidgetRenderer } from "./widget-renderer";
import { WidgetCatalog } from "./widget-catalog";
import { WIDGET_REGISTRY, type WidgetId } from "@/lib/dashboard/widgets-registry";
import type { GridLayoutItem, WidgetInstance } from "@/lib/db/schema/dashboards";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };

export function DashboardGrid() {
  const utils = trpc.useUtils();
  const layoutQuery = trpc.dashboards.getMyLayout.useQuery();
  const aggregateQuery = trpc.aggregate.get.useQuery();
  const saveMutation = trpc.dashboards.saveLayout.useMutation({
    onSuccess: () => utils.dashboards.getMyLayout.invalidate(),
  });
  const resetMutation = trpc.dashboards.resetToDefault.useMutation({
    onSuccess: () => utils.dashboards.getMyLayout.invalidate(),
  });

  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Local mirror of grid + widgets so we can mutate fast and debounce-save.
  const [gridConfig, setGridConfig] = useState<GridLayoutItem[]>([]);
  const [widgets, setWidgets] = useState<Record<string, WidgetInstance>>({});

  // Sync from server query on first load / refresh.
  useEffect(() => {
    if (layoutQuery.data) {
      setGridConfig(layoutQuery.data.gridConfig as GridLayoutItem[]);
      setWidgets(layoutQuery.data.widgets as Record<string, WidgetInstance>);
    }
  }, [layoutQuery.data]);

  // Debounced save when layout changes.
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const queueSave = (next: { gridConfig: GridLayoutItem[]; widgets: Record<string, WidgetInstance> }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMutation.mutate(next);
    }, 600);
  };

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (!editing) return;
    const next = newLayout.map((l) => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    }));
    setGridConfig(next);
    queueSave({ gridConfig: next, widgets });
  };

  const handleAddWidget = (type: WidgetId) => {
    const def = WIDGET_REGISTRY[type];
    const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
    const maxY = gridConfig.reduce((m, g) => Math.max(m, g.y + g.h), 0);
    const newItem: GridLayoutItem = {
      i: id,
      x: 0,
      y: maxY,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
    };
    const nextGrid = [...gridConfig, newItem];
    const nextWidgets = { ...widgets, [id]: { type } };
    setGridConfig(nextGrid);
    setWidgets(nextWidgets);
    queueSave({ gridConfig: nextGrid, widgets: nextWidgets });
  };

  const handleRemoveWidget = (instanceId: string) => {
    const nextGrid = gridConfig.filter((g) => g.i !== instanceId);
    const nextWidgets = { ...widgets };
    delete nextWidgets[instanceId];
    setGridConfig(nextGrid);
    setWidgets(nextWidgets);
    queueSave({ gridConfig: nextGrid, widgets: nextWidgets });
  };

  const handleReset = () => {
    if (confirm("Reset to default layout? Your customizations will be lost.")) {
      resetMutation.mutate();
    }
  };

  const layouts = useMemo<Layouts>(() => ({ lg: gridConfig as Layout[] }), [gridConfig]);

  const isLoading = layoutQuery.isLoading || aggregateQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-[120px] rounded-md" />
          ))}
        </div>
        <ShimmerSkeleton className="h-[280px] rounded-md" />
      </div>
    );
  }

  if (!aggregateQuery.data) {
    return (
      <div className="rounded-md border border-border bg-bg-elevated p-6 text-center text-fg-muted">
        Could not load dashboard data.
      </div>
    );
  }

  const data = aggregateQuery.data;
  const widgetCount = gridConfig.length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-fg">Overview</h1>
          <span className="text-[12px] text-fg-muted">
            · {widgetCount} {widgetCount === 1 ? "widget" : "widgets"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setCatalogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add widget
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button size="sm" onClick={() => setEditing(false)}>
                <Check className="h-3.5 w-3.5" />
                Done
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Sparkles className="h-3.5 w-3.5" />
              Customize
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {widgetCount === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 py-16 px-6 text-center">
          <p className="text-fg-muted text-[13px] mb-3">Your dashboard is empty.</p>
          <Button size="sm" onClick={() => setCatalogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add your first widget
          </Button>
        </div>
      ) : (
        <div className={editing ? "fin-grid-editing" : ""}>
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={64}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            isDraggable={editing}
            isResizable={editing}
            draggableHandle=".widget-drag-handle"
            onLayoutChange={handleLayoutChange}
            useCSSTransforms
            compactType="vertical"
          >
            {gridConfig.map((item) => {
              const widget = widgets[item.i];
              if (!widget) return <div key={item.i} />;
              return (
                <div key={item.i} className="overflow-hidden">
                  <WidgetRenderer
                    type={widget.type as WidgetId}
                    data={data}
                    editing={editing}
                    onRemove={() => handleRemoveWidget(item.i)}
                  />
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* Catalog */}
      <WidgetCatalog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onAdd={handleAddWidget}
        existingTypes={Object.values(widgets).map((w) => w.type as WidgetId)}
      />
    </div>
  );
}
