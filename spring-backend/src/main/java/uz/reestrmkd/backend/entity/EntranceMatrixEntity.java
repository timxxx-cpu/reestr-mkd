package uz.reestrmkd.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "entrance_matrix")
public class EntranceMatrixEntity {
    @Id
    private UUID id;

    @Column(name = "block_id", nullable = false)
    private UUID blockId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "matrix_data", columnDefinition = "jsonb")
    private Map<String, Object> matrixData;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockId() { return blockId; }
    public void setBlockId(UUID blockId) { this.blockId = blockId; }
    public Map<String, Object> getMatrixData() { return matrixData; }
    public void setMatrixData(Map<String, Object> matrixData) { this.matrixData = matrixData; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
