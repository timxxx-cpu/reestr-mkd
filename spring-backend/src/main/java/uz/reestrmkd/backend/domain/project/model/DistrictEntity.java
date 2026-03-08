package uz.reestrmkd.backend.domain.project.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "districts")
public class DistrictEntity {

    @Id
    private UUID id;

    @Column(name = "soato")
    private String soato;

    @Column(name = "region_id")
    private UUID regionId;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSoato() { return soato; }
    public void setSoato(String soato) { this.soato = soato; }
    public UUID getRegionId() { return regionId; }
    public void setRegionId(UUID regionId) { this.regionId = regionId; }
}
