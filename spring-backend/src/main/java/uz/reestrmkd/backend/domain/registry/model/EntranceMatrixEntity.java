package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "entrance_matrix")
public class EntranceMatrixEntity {
    @Id
    private UUID id;

    @Column(name = "block_id", nullable = false)
    private UUID blockId;

    @Column(name = "floor_id", nullable = false)
    private UUID floorId;

    @Column(name = "entrance_number", nullable = false)
    private Integer entranceNumber;

    @Column(name = "flats_count")
    private Integer flatsCount;

    @Column(name = "commercial_count")
    private Integer commercialCount;

    @Column(name = "mop_count")
    private Integer mopCount;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockId() { return blockId; }
    public void setBlockId(UUID blockId) { this.blockId = blockId; }
    public UUID getFloorId() { return floorId; }
    public void setFloorId(UUID floorId) { this.floorId = floorId; }
    public Integer getEntranceNumber() { return entranceNumber; }
    public void setEntranceNumber(Integer entranceNumber) { this.entranceNumber = entranceNumber; }
    public Integer getFlatsCount() { return flatsCount; }
    public void setFlatsCount(Integer flatsCount) { this.flatsCount = flatsCount; }
    public Integer getCommercialCount() { return commercialCount; }
    public void setCommercialCount(Integer commercialCount) { this.commercialCount = commercialCount; }
    public Integer getMopCount() { return mopCount; }
    public void setMopCount(Integer mopCount) { this.mopCount = mopCount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
