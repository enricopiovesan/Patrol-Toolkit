export type OSMNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

export type OSMWay = {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};

export type OSMRelationMember = {
  type: "node" | "way" | "relation";
  ref: number;
  role: string;
};

export type OSMRelation = {
  type: "relation";
  id: number;
  members: OSMRelationMember[];
  tags?: Record<string, string>;
};

export type OSMElement = OSMNode | OSMWay | OSMRelation;

export type OSMDocument = {
  version?: number;
  generator?: string;
  osm3s?: {
    timestamp_osm_base?: string;
  };
  elements: OSMElement[];
};

