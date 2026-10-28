// Build a draft only; saving, testing and activation remain separate runtime calls.
export function editDefinition(current, fields) {
  const pack = structuredClone(
    current ?? {
      format: "paw-swu-pack",
      schemaVersion: 1,
      id: fields.id,
      version: "0.1.0",
      name: fields.name,
      scope: { origin: null, pathPrefix: "/", conditions: [] },
      roles: [],
      permissions: ["read"],
      procedures: [],
    },
  );
  pack.id = fields.id;
  pack.name = fields.name;
  pack.version = fields.version;
  pack.scope = {
    ...pack.scope,
    origin: fields.origin.trim() || null,
    pathPrefix: fields.pathPrefix,
  };
  const role = {
    id: fields.role,
    locator: { selector: fields.selector },
    extract: fields.extract,
    cardinality: fields.cardinality,
    limit: Number(fields.limit),
  };
  const index = pack.roles.findIndex((r) => r.id === fields.role);
  if (index === -1) pack.roles.push(role);
  else
    pack.roles[index] = {
      ...pack.roles[index],
      ...role,
      locator: { ...pack.roles[index].locator, ...role.locator },
    };
  if (fields.kind !== "read") {
    const step = { kind: fields.kind, role: fields.role };
    const parameters = fields.parameter ? [fields.parameter] : [];
    if (fields.kind === "fill")
      Object.assign(
        step,
        fields.parameter
          ? { parameter: fields.parameter }
          : { text: fields.value },
      );
    if (fields.kind === "scroll") step.dy = Number(fields.value);
    if (fields.kind === "click" && fields.parameter)
      step.linkParameter = fields.parameter;
    const procedure = {
      id: fields.procedure,
      parameters,
      preconditions: [],
      postconditions: [],
      steps: [step],
    };
    const previous = pack.procedures.find((p) => p.id === fields.procedure);
    if (previous) previous.steps.push(step);
    else pack.procedures.push(procedure);
    if (previous)
      previous.parameters = [
        ...new Set([...previous.parameters, ...parameters]),
      ];
    pack.permissions = [...new Set([...pack.permissions, fields.kind])];
  }
  return pack;
}
