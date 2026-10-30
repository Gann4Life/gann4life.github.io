import { z } from 'astro/zod';
import { COLLECTIONS, type CollectionDef, type CollectionName, type Field } from './content-fields.ts';

type EnumShape<F> = F extends { options: readonly { value: infer V extends string }[] } ? { [K in V]: K } : never;

type Base<F, Image extends z.ZodType> = F extends { type: 'text' | 'longtext' }
  ? z.ZodString
  : F extends { type: 'boolean' }
    ? z.ZodBoolean
    : F extends { type: 'enum' }
      ? z.ZodEnum<EnumShape<F>>
      : F extends { type: 'date' }
        ? z.ZodCoercedDate
        : F extends { type: 'url' }
          ? F extends { default: '' }
            ? z.ZodUnion<[z.ZodURL, z.ZodLiteral<''>]>
            : z.ZodURL
          : F extends { type: 'tags' }
            ? z.ZodArray<z.ZodEnum<EnumShape<F>>>
            : F extends { type: 'refs' }
              ? z.ZodArray<z.ZodString>
              : F extends { type: 'list'; fields: infer Items extends readonly Field[] }
                ? z.ZodArray<z.ZodObject<ShapeOf<Items, Image>>>
                : F extends { type: 'image' }
                  ? Image
                  : never;

type Wrapped<F, Image extends z.ZodType> = F extends { default: unknown }
  ? z.ZodDefault<Base<F, Image>>
  : F extends { required: true }
    ? Base<F, Image>
    : z.ZodOptional<Base<F, Image>>;

type ShapeOf<Fields extends readonly Field[], Image extends z.ZodType> = {
  [F in Fields[number] as F extends { type: 'markdown' } ? never : F['name']]: Wrapped<F, Image>;
};

type EntryShape<Name extends CollectionName, Image extends z.ZodType> = ShapeOf<
  (typeof COLLECTIONS)[Name]['fields'],
  Image
> & { slug: z.ZodOptional<z.ZodString> };

function buildField(field: Field, image: () => z.ZodType): z.ZodType {
  const values = (field.options ?? []).map((option) => option.value) as [string, ...string[]];
  let schema: z.ZodType;
  switch (field.type) {
    case 'text':
      schema = field.required ? z.string().min(1) : z.string();
      break;
    case 'longtext':
      schema = z.string();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'enum':
      schema = z.enum(values);
      break;
    case 'date':
      schema = z.coerce.date();
      break;
    case 'url':
      schema = field.default === '' ? z.union([z.url(), z.literal('')]) : z.url();
      break;
    case 'tags':
      schema = z.array(z.enum(values));
      break;
    case 'refs':
      schema = z.array(z.string());
      break;
    case 'list':
      schema = z.array(z.object(buildShape(field.fields ?? [], image)));
      break;
    case 'image':
      schema = image();
      break;
    default:
      throw new Error(`Field "${field.name}" of type "${field.type}" has no frontmatter schema.`);
  }
  if (field.default !== undefined) return schema.default(field.default as never);
  if (field.required) return schema;
  return schema.optional();
}

function buildShape(fields: readonly Field[], image: () => z.ZodType): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (field.type === 'markdown') continue;
    shape[field.name] = buildField(field, image);
  }
  return shape;
}

export function schemaFor<Name extends CollectionName, Image extends z.ZodType>(collection: Name, image: () => Image) {
  const def: CollectionDef = COLLECTIONS[collection];
  const reserved = def.reserved;
  const shape = {
    ...buildShape(def.fields, image),
    slug: z
      .string()
      .min(1)
      .refine((s) => !reserved.includes(s), `Reserved slugs: ${reserved.map((r) => `"${r}"`).join(', ')}.`)
      .optional(),
  } as unknown as EntryShape<Name, Image>;
  return z.object(shape).superRefine((entry, ctx) =>
    def.refine?.(entry, (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })),
  );
}
