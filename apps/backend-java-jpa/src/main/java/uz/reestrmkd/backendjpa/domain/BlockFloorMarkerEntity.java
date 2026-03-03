package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "block_floor_markers")
public class BlockFloorMarkerEntity extends BaseEntity {

    @Column(name = "block_id", nullable = false)
    private String blockId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id", insertable = false, updatable = false)
    private BuildingBlockEntity block;

    @Column(name = "marker_key", nullable = false)
    private String markerKey;

    @Column(name = "marker_type", nullable = false)
    private String markerType;

    @Column(name = "floor_index")
    private Integer floorIndex;

    @Column(name = "parent_floor_index")
    private Integer parentFloorIndex;

    @Column(name = "is_technical", nullable = false)
    private Boolean isTechnical = false;

    @Column(name = "is_commercial", nullable = false)
    private Boolean isCommercial = false;
}
