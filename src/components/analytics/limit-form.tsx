"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { deleteExpenseImport } from "@/app/actions/expenses";
import { createLimit, deleteLimit } from "@/app/actions/limits";
import { limitSchema, type LimitInput, type LimitOutput } from "@/lib/schemas";
import { FieldRow, Section } from "@/components/ios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";

export function LimitForm({ stores, categories }: { stores: { key: string; label: string }[]; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<LimitInput, unknown, LimitOutput>({
    resolver: zodResolver(limitSchema),
    defaultValues: { scope: "TOTAL", scopeValue: null, period: "MONTHLY", amount: "" },
  });
  const scope = form.watch("scope");
  const errors = form.formState.errors;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 py-3 pl-4 text-body text-primary">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary text-white">
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </span>
        Añadir límite
      </button>
    );
  }

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const res = await createLimit(values);
      if (!res.ok) return setError(res.error);
      form.reset();
      setOpen(false);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t bg-background/40 p-3">
      <Section>
        <FieldRow label="Aplica a">
          <NativeSelect
            {...form.register("scope", { onChange: () => form.setValue("scopeValue", null) })}
          >
            <option value="TOTAL">Todo el gasto</option>
            <option value="CATEGORY">Una categoría</option>
            <option value="STORE">Una tienda</option>
          </NativeSelect>
        </FieldRow>
        {scope !== "TOTAL" && (
          <FieldRow label={scope === "CATEGORY" ? "Categoría" : "Tienda"} error={errors.scopeValue?.message}>
            <NativeSelect {...form.register("scopeValue")} defaultValue="">
              <option value="" disabled>
                Elegir…
              </option>
              {scope === "CATEGORY"
                ? categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                : stores.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
            </NativeSelect>
          </FieldRow>
        )}
        <FieldRow label="Periodo">
          <NativeSelect {...form.register("period")}>
            <option value="MONTHLY">Mensual</option>
            <option value="YEARLY">Anual</option>
          </NativeSelect>
        </FieldRow>
        <FieldRow label="Monto" error={errors.amount?.message}>
          <Input type="number" inputMode="decimal" step="0.01" placeholder="$0.00" autoFocus {...form.register("amount")} />
        </FieldRow>
      </Section>
      {error && <p className="px-1 text-footnote text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="gray" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </div>
    </form>
  );
}

export function DeleteButton({ id, kind, label }: { id: string; kind: "limit" | "import"; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (kind === "import" && !confirm("¿Eliminar este archivo y todos sus gastos?")) return;
          if (kind === "limit") await deleteLimit(id);
          else await deleteExpenseImport(id);
        })
      }
      className="press -mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
