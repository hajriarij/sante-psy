export type Patient = {
    id:string,
    firstNames: string,
    lastName: string,
    INE?: string,
    institutionName?: string,
    isStudentStatusVerified?: boolean,
    hasPrescription?: boolean,
    psychologistId: string,
    doctorName?: string,
    doctorAddress?: string,
    dateOfBirth?: Date | null,
    deleted?: boolean,
    updatedAt?: Date,
    renewed?: boolean // Deprecated: used on 2022/2023 only
}
