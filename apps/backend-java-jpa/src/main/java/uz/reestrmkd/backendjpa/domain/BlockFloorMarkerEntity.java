package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "block_floor_markers")
public class BlockFloorMarkerEntity extends BaseEntity {
    @Column(name = "block_id", nullable = false) private String blockId;
    @Column(name = "marker_key", nullable = false) private String markerKey;
    @Column(name = "marker_type", nullable = false) private String markerType;
    @Column(name = "floor_index") private Integer floorIndex;
    @Column(name = "parent_floor_index") private Integer parentFloorIndex;
    @Column(name = "is_technical", nullable = false) private Boolean isTechnical = false;
    @Column(name = "is_commercial", nullable = false) private Boolean isCommercial = false;
}