export type Destination = "da_lat" | "nha_trang";

export type TransportMethod = "self" | "tour_bus";

export type PickupPoint =
  | "Hà Tĩnh"
  | "Quảng Bình"
  | "Quảng Trị"
  | "TP. Huế"
  | "Đà Nẵng"
  | "Quảng Nam"
  | "Quảng Ngãi";

export interface Employee {
  id: string;
  fullName: string;
  department: string;
  store: string;
  destination: Destination;
}

export interface Tour {
  id: string;
  destination: Destination;
  name: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  registeredCount: number;
  adultPrice: number;
  childPrice: number;
  pdfUrl: string;
  imageUrl: string;
}

export interface Companion {
  id: string;
  fullName: string;
  dob: string;
  gender: "male" | "female";
  relationship: string;
  type: "adult" | "child";
}

export interface Registration {
  id: string;
  employeeId: string;
  tourId: string;
  transportMethod: TransportMethod;
  pickupPoint: PickupPoint | null;
  companions: Companion[];
  totalPrice: number;
  createdAt: string;
}
