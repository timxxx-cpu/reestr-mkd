package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "block_construction")
public class BlockConstructionEntity {
    @Id
    private UUID id;
    @Column(name = "block_id", nullable = false)
    private UUID blockId;
    private String foundation;
    private String walls;
    private String slabs;
    private String roof;
    private Integer seismicity;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockId() { return blockId; }
    public void setBlockId(UUID blockId) { this.blockId = blockId; }
    public String getFoundation() { return foundation; }
    public void setFoundation(String foundation) { this.foundation = foundation; }
    public String getWalls() { return walls; }
    public void setWalls(String walls) { this.walls = walls; }
    public String getSlabs() { return slabs; }
    public void setSlabs(String slabs) { this.slabs = slabs; }
    public String getRoof() { return roof; }
    public void setRoof(String roof) { this.roof = roof; }
    public Integer getSeismicity() { return seismicity; }
    public void setSeismicity(Integer seismicity) { this.seismicity = seismicity; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
